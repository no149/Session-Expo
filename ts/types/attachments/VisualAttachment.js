"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickFileForAvatar = exports.autoScaleAvatarBlob = exports.revokeObjectUrl = exports.makeObjectUrl = exports.makeVideoScreenshot = exports.makeImageThumbnailBuffer = exports.getImageDimensions = exports.urlToBlob = exports.THUMBNAIL_CONTENT_TYPE = exports.THUMBNAIL_SIDE = void 0;
const Errors_1 = require("./Errors");
const DecryptedAttachmentsManager_1 = require("../../../ts/session/crypto/DecryptedAttachmentsManager");
const blob_util_1 = require("blob-util");
const attachmentsUtil_1 = require("../../util/attachmentsUtil");
const util_1 = require("../../util");
const utils_1 = require("../../session/utils");
exports.THUMBNAIL_SIDE = 200;
exports.THUMBNAIL_CONTENT_TYPE = 'image/png';
const urlToBlob = async (dataUrl) => {
    return (await fetch(dataUrl)).blob();
};
exports.urlToBlob = urlToBlob;
const getImageDimensions = async ({ objectUrl, }) => new Promise(async (resolve, reject) => {
    const image = document.createElement('img');
    image.addEventListener('load', () => {
        resolve({
            height: image.naturalHeight,
            width: image.naturalWidth,
        });
    });
    image.addEventListener('error', error => {
        window.log.error('getImageDimensions error', (0, Errors_1.toLogFormat)(error));
        reject(error);
    });
    const decryptedUrl = await (0, DecryptedAttachmentsManager_1.getDecryptedMediaUrl)(objectUrl, 'image/jpg', false);
    image.src = decryptedUrl;
});
exports.getImageDimensions = getImageDimensions;
const makeImageThumbnailBuffer = async ({ objectUrl, contentType, }) => {
    if (!util_1.GoogleChrome.isImageTypeSupported(contentType)) {
        throw new Error('makeImageThumbnailBuffer can only be called with what GoogleChrome image type supports');
    }
    const decryptedBlob = await (0, DecryptedAttachmentsManager_1.getDecryptedBlob)(objectUrl, contentType);
    const scaled = await (0, attachmentsUtil_1.autoScaleForThumbnail)({ contentType, blob: decryptedBlob });
    return (0, blob_util_1.blobToArrayBuffer)(scaled.blob);
};
exports.makeImageThumbnailBuffer = makeImageThumbnailBuffer;
const makeVideoScreenshot = async ({ objectUrl, contentType = 'image/png', }) => new Promise(async (resolve, reject) => {
    const video = document.createElement('video');
    function capture() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctxCanvas = canvas.getContext('2d');
        if (!ctxCanvas) {
            throw new Error('Failed to get a 2d context for canvas of video in capture()');
        }
        ctxCanvas.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = (0, blob_util_1.dataURLToBlob)(canvas.toDataURL(contentType));
        video.removeEventListener('canplay', capture);
        video.pause();
        video.currentTime = 0;
        resolve(blob);
    }
    video.addEventListener('canplay', capture);
    video.addEventListener('error', error => {
        window.log.error('makeVideoScreenshot error', (0, Errors_1.toLogFormat)(error));
        reject(error);
    });
    const decryptedUrl = await (0, DecryptedAttachmentsManager_1.getDecryptedMediaUrl)(objectUrl, contentType, false);
    video.src = decryptedUrl;
    video.muted = true;
    await video.play();
});
exports.makeVideoScreenshot = makeVideoScreenshot;
const makeObjectUrl = (data, contentType) => {
    const blob = new Blob([data], {
        type: contentType,
    });
    return URL.createObjectURL(blob);
};
exports.makeObjectUrl = makeObjectUrl;
const revokeObjectUrl = (objectUrl) => {
    URL.revokeObjectURL(objectUrl);
};
exports.revokeObjectUrl = revokeObjectUrl;
async function autoScaleAvatarBlob(file) {
    try {
        const scaled = await (0, attachmentsUtil_1.autoScaleForAvatar)({ blob: file, contentType: file.type });
        const url = window.URL.createObjectURL(scaled.blob);
        return url;
    }
    catch (e) {
        utils_1.ToastUtils.pushToastError('pickFileForAvatar', 'An error happened while picking/resizing the image', e.message || '');
        window.log.error(e);
        return null;
    }
}
exports.autoScaleAvatarBlob = autoScaleAvatarBlob;
async function pickFileForAvatar() {
    if (process.env.NODE_APP_INSTANCE?.includes('test-integration')) {
        window.log.info('shorting pickFileForAvatar as it does not work in playwright/notsending the filechooser event');
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('we need a context');
        }
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return new Promise(resolve => {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], 'image.png', { type: 'image/png' });
                const url = await autoScaleAvatarBlob(file);
                resolve(url);
            });
        });
    }
    else {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [
                {
                    description: 'Images',
                    accept: {
                        'image/*': ['.png', '.gif', '.jpeg', '.jpg'],
                    },
                },
            ],
            excludeAcceptAllOption: true,
            multiple: false,
        });
        const file = (await fileHandle.getFile());
        return autoScaleAvatarBlob(file);
    }
}
exports.pickFileForAvatar = pickFileForAvatar;
