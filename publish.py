#!/usr/bin/env python3
"""
一键发布脚本
用法:
  python publish.py              发布前端 + 后端
  python publish.py --frontend   只发前端
  python publish.py --backend    只发后端
"""
import paramiko
import tarfile
import os
import io
import time
import sys
import subprocess

# ====== 服务器配置（勿把真实密码写入仓库）======
HOST = os.environ.get('DEPLOY_HOST', '').strip()
USER = os.environ.get('DEPLOY_USER', 'root').strip()
PASSWORD = os.environ.get('DEPLOY_PASSWORD', '').strip()
REMOTE_BASE = os.environ.get('DEPLOY_REMOTE_BASE', '/var/www/ark_aigc_demo').strip()

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_SRC = os.path.join(PROJECT_ROOT, 'Server_python')
FRONTEND_BUILD = os.path.join(PROJECT_ROOT, 'build')


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
    result = subprocess.run(
        ['npm', 'run', 'build'],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=300,
        shell=True,
    )
    if result.returncode != 0:
        print('  构建失败！')
        print(result.stdout[-500:] if result.stdout else '')
        print(result.stderr[-500:] if result.stderr else '')
        return False
    print('  构建成功')
    return True


def make_frontend_tar():
    """打包 build/ 目录"""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        tar.add(FRONTEND_BUILD, arcname='build')
    return buf.getvalue()


def make_backend_tar():
    """打包 Server_python 源码 (不含 venv / __pycache__ / .pyc / app.db)"""
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
    # 备份当前 data 目录 (SQLite 数据库)，避免覆盖
    run_remote(ssh, f'cp -r {REMOTE_BASE}/server/data {REMOTE_BASE}/server_data_backup 2>/dev/null; echo ok', quiet=True)
    # 解压源码
    run_remote(ssh, f'tar -xzf /tmp/ark_backend.tar.gz -C {REMOTE_BASE} && echo "后端代码已更新"')
    # 恢复数据库
    run_remote(ssh, f'cp -r {REMOTE_BASE}/server_data_backup/* {REMOTE_BASE}/server/data/ 2>/dev/null; rm -rf {REMOTE_BASE}/server_data_backup; echo ok', quiet=True)
    # 如果 requirements.txt 有变化，自动安装依赖
    run_remote(ssh, f'{REMOTE_BASE}/server/venv/bin/pip install -r {REMOTE_BASE}/server/requirements.txt 2>&1 | tail -2')
    # 重启服务
    run_remote(ssh, 'systemctl restart ark-aigc-demo')
    time.sleep(2)
    code, out, _ = run_remote(ssh, 'systemctl is-active ark-aigc-demo')
    if 'active' in out:
        print('  后端服务已重启')
    else:
        print('  [警告] 服务可能未正常启动，请检查:')
        run_remote(ssh, 'systemctl status ark-aigc-demo --no-pager | head -15')
    run_remote(ssh, 'rm -f /tmp/ark_backend.tar.gz')


def main():
    if not HOST or not PASSWORD:
        print('请先设置环境变量 DEPLOY_HOST / DEPLOY_PASSWORD（可选 DEPLOY_USER、DEPLOY_REMOTE_BASE）')
        sys.exit(1)

    do_frontend = '--backend' not in sys.argv
    do_backend = '--frontend' not in sys.argv
    if '--frontend' in sys.argv and '--backend' not in sys.argv:
        do_backend = False
    if '--backend' in sys.argv and '--frontend' not in sys.argv:
        do_frontend = False

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
        if do_frontend:
            run_remote(ssh, 'systemctl reload nginx')
        banner('发布完成')
        run_remote(ssh, 'echo "服务状态:"; systemctl is-active ark-aigc-demo')
        print(f'\n  访问地址: https://{HOST}:3000\n')
    finally:
        ssh.close()


if __name__ == '__main__':
    main()
