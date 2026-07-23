#!/usr/bin/env python3
"""一键发布脚本"""
import paramiko, tarfile, os, io, time, sys, subprocess

HOST = os.environ.get('DEPLOY_HOST', '').strip()
USER = os.environ.get('DEPLOY_USER', 'root').strip()
PASSWORD = os.environ.get('DEPLOY_PASSWORD', '').strip()
REMOTE_BASE = os.environ.get('DEPLOY_REMOTE_BASE', '/var/www/ark_aigc_demo').strip()
REMOTE_API_PORT = int(os.environ.get('DEPLOY_API_PORT', '3001'))
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))


def _resolve_backend_src() -> str:
    for name in ('server_python', 'Server_python'):
        path = os.path.join(PROJECT_ROOT, name)
        if os.path.isdir(path):
            return path
    return os.path.join(PROJECT_ROOT, 'server_python')


BACKEND_SRC = _resolve_backend_src()
FRONTEND_BUILD = os.path.join(PROJECT_ROOT, 'build')
API_PATHS = ['/chat', '/auth', '/conversations', '/getScenes', '/proxy']
PRESERVE_REMOTE = [
    'data',
    '.env',
    'scenes/Custom.json',
]

def banner(msg):
    print(f'\n{"=" * 50}')
    print(f'  {msg}')
    print(f'{"=" * 50}\n')

def ssh_connect():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=20)
    return ssh

def run_remote(ssh, cmd, quiet=False):
    if not quiet:
        print(f'  $ {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if not quiet:
        if out:
            print(f'    {out[:500]}')
        if err and code != 0:
            print(f'    [stderr] {err[:300]}')
    return code, out, err

def upload_tar(ssh, tar_bytes, remote_path):
    sftp = ssh.open_sftp()
    sftp.putfo(io.BytesIO(tar_bytes), remote_path)
    sftp.close()

def build_frontend():
    banner('构建前端 (npm run build)')
    result = subprocess.run(['npm', 'run', 'build'], cwd=PROJECT_ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300, shell=True)
    if result.returncode != 0:
        print('  构建失败!')
        print(result.stdout[-500:] if result.stdout else '')
        print(result.stderr[-500:] if result.stderr else '')
        return False
    print('  构建成功')
    return True

def make_frontend_tar():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        tar.add(FRONTEND_BUILD, arcname='build')
    return buf.getvalue()

def make_backend_tar():
    skip_dirs = {'__pycache__', 'venv', '.venv', 'node_modules'}
    skip_files = {'app.db'}
    def filter_fn(ti):
        parts = ti.name.split('/')
        if any(p in skip_dirs for p in parts):
            return None
        if os.path.basename(ti.name) in skip_files:
            return None
        if ti.name.endswith('.pyc'):
            return None
        return ti
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        tar.add(BACKEND_SRC, arcname='server', filter=filter_fn)
    return buf.getvalue()

def deploy_frontend(ssh):
    tar = make_frontend_tar()
    size_mb = len(tar) / 1024 / 1024
    print(f'  上传前端 ({size_mb:.1f} MB)...')
    upload_tar(ssh, tar, '/tmp/ark_frontend.tar.gz')
    run_remote(ssh, f'rm -rf {REMOTE_BASE}/build_old && mv {REMOTE_BASE}/build {REMOTE_BASE}/build_old 2>/dev/null; mkdir -p {REMOTE_BASE}/build')
    run_remote(ssh, f'tar -xzf /tmp/ark_frontend.tar.gz -C {REMOTE_BASE} && echo "前端文件已更新"')
    run_remote(ssh, f'rm -rf {REMOTE_BASE}/build_old /tmp/ark_frontend.tar.gz')

def deploy_backend(ssh):
    tar = make_backend_tar()
    size_mb = len(tar) / 1024 / 1024
    print(f'  上传后端 ({size_mb:.1f} MB)...')
    upload_tar(ssh, tar, '/tmp/ark_backend.tar.gz')
    # 备份线上数据与密钥，避免被本地打包覆盖
    run_remote(
        ssh,
        f'''
set -e
BASE="{REMOTE_BASE}"
rm -rf /tmp/ark_server_preserve
mkdir -p /tmp/ark_server_preserve
for rel in data .env scenes/Custom.json; do
  if [ -e "$BASE/server/$rel" ]; then
    mkdir -p "/tmp/ark_server_preserve/$(dirname "$rel")"
    cp -a "$BASE/server/$rel" "/tmp/ark_server_preserve/$rel"
  fi
done
mkdir -p "$BASE/server"
tar -xzf /tmp/ark_backend.tar.gz -C "$BASE"
# tar 解出的是 server/ 目录
for rel in data .env scenes/Custom.json; do
  if [ -e "/tmp/ark_server_preserve/$rel" ]; then
    mkdir -p "$BASE/server/$(dirname "$rel")"
    rm -rf "$BASE/server/$rel"
    cp -a "/tmp/ark_server_preserve/$rel" "$BASE/server/$rel"
  fi
done
rm -rf /tmp/ark_server_preserve /tmp/ark_backend.tar.gz
echo "后端代码已更新（已保留 data/.env/Custom.json）"
''',
    )
    run_remote(ssh, f'{REMOTE_BASE}/server/venv/bin/pip install -r {REMOTE_BASE}/server/requirements.txt 2>&1 | tail -5')
    run_remote(ssh, 'systemctl restart ark-aigc-demo')
    time.sleep(2)
    code, out, _ = run_remote(ssh, 'systemctl is-active ark-aigc-demo')
    if 'active' in out:
        print('  后端服务已重启')
    else:
        print('  [警告] 服务可能未正常启动，请检查')
        run_remote(ssh, 'systemctl status ark-aigc-demo --no-pager | head -15')
        run_remote(ssh, 'journalctl -u ark-aigc-demo -n 40 --no-pager')

def fix_nginx(ssh):
    banner('检查 nginx API 代理配置')
    code, conf_path, _ = run_remote(
        ssh, f'grep -rl "{REMOTE_BASE}" /etc/nginx/ 2>/dev/null | head -1', quiet=True
    )
    if not conf_path or code != 0:
        print('  [警告] 未找到 nginx 配置文件')
        print(f'  请手动将以下路径代理到 localhost:{REMOTE_API_PORT}: {", ".join(API_PATHS)}')
        return
    print(f'  找到配置: {conf_path}')
    # 支持精确 location 或正则 location ~ ^/(chat|auth|...)
    missing = []
    for path in API_PATHS:
        name = path.lstrip('/')
        code, _, _ = run_remote(
            ssh,
            f'grep -E "location[[:space:]]+{path}([[:space:]]|\\{{)|location[[:space:]]+~[[:space:]].*{name}" {conf_path} >/dev/null 2>&1',
            quiet=True,
        )
        if code != 0:
            missing.append(path)
    if not missing:
        print('  nginx API 代理配置已完整，无需修复')
        run_remote(ssh, 'nginx -t 2>&1 && systemctl reload nginx')
        return
    print(f'  缺少 API 代理路径: {", ".join(missing)}')
    print('  自动 sed 插入已禁用（易破坏配置），请手工在配置中加入类似：')
    print(f'  location ~ ^/({"|".join(p.lstrip("/") for p in API_PATHS)}) {{')
    print(f'      proxy_pass http://127.0.0.1:{REMOTE_API_PORT};')
    print('      proxy_set_header Host $http_host;')
    print('      proxy_buffering off;')
    print('  }')
    run_remote(ssh, 'nginx -t 2>&1 && systemctl reload nginx')

def main():
    if not HOST or not PASSWORD:
        print('请先设置环境变量 DEPLOY_HOST / DEPLOY_PASSWORD')
        sys.exit(1)
    do_frontend = '--backend' not in sys.argv
    do_backend = '--frontend' not in sys.argv
    if '--frontend' in sys.argv and '--backend' not in sys.argv:
        do_backend = False
    if '--backend' in sys.argv and '--frontend' not in sys.argv:
        do_frontend = False
    do_nginx_fix = '--skip-nginx' not in sys.argv

    if do_frontend:
        if not build_frontend():
            print('\n前端构建失败，发布中止')
            return

    banner(f'发布到 {HOST}:{REMOTE_BASE}')
    ssh = ssh_connect()
    print('  已连接服务器')
    try:
        if do_frontend:
            banner('更新前端')
            deploy_frontend(ssh)
        if do_backend:
            banner('更新后端')
            deploy_backend(ssh)
        if do_nginx_fix:
            fix_nginx(ssh)
        elif do_frontend:
            run_remote(ssh, 'systemctl reload nginx')
        banner('发布完成')
        run_remote(ssh, 'echo "服务状态:"; systemctl is-active ark-aigc-demo')
        print(f'\n  访问地址: https://{HOST}:3000/')
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
