/**
 * Copyright 2025 Beijing Volcano Engine Technology Co., Ltd. All Rights Reserved.
 * SPDX-license-identifier: BSD-3-Clause
 */
const fs = require('fs');
const path = require('path');

const judgeMethodPath = (method) => {
    return (ctx, pathname) => ctx.method.toLowerCase() === method && ctx.url.startsWith(`/${pathname}`);
}

const readFiles = (dir, suffix) => {
    const scenes = {};
    fs.readdirSync(path.join(__dirname, dir)).map((p) => {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, dir, p)));
        scenes[p.replace(suffix, '')] = data;
    });
    return scenes;
}

const assert = (expression, msg) => {
    if (!!!expression || expression?.includes?.(' ')) {
        console.log(`\x1b[31m校验失败: ${msg}\x1b[0m`)
      throw new Error(msg);
    }
}

/** RTC AppId 为 24 位十六进制；ASR/TTS 需使用语音技术控制台的纯数字 AppId */
const isRtcStyleAppId = (appId) => typeof appId === 'string' && /^[a-f0-9]{20,}$/i.test(appId);

const assertSpeechAppId = (appId, label) => {
    assert(appId, `${label} 不能为空。请前往 https://console.volcengine.com/speech/service/app 创建应用并填写 AppId（纯数字，不是 RTC AppId）`);
    assert(!isRtcStyleAppId(appId), `${label} 填错了：当前值 "${appId}" 是 RTC AppId，ASR/TTS 必须使用语音技术控制台的应用 ID（通常为纯数字）`);
};

const wrapper = async ({
    ctx,
    method = 'post',
    apiName,
    logic,
    containResponseMetadata = true,
}) => {
    if (judgeMethodPath(method)(ctx, apiName)) {
        const ResponseMetadata = { Action: apiName };
        try {
            const res = await logic();
            ctx.body = containResponseMetadata ? {
                ResponseMetadata,
                Result: res,
            } : res;
        } catch (e) {
            ResponseMetadata.Error = {
                Code: -1,
                Message: e?.toString(),
            };
            ctx.body = {
                ResponseMetadata,
            }
        }
    }
}

const deepAssert = (params = {}, prefix = '') => {
    if (typeof params === 'object') {
        Object.keys(params).forEach(key => {
            assert(params[key], `${prefix}: ${key} 不能为空, 请修改 /Server/sensitive.js`);
            deepAssert(params[key], `${prefix}: ${key}.`);
        })
    }
}

module.exports = {
    wrapper,
    assert,
    readFiles,
    isRtcStyleAppId,
    assertSpeechAppId,
}
