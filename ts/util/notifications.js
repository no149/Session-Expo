"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notifications = void 0;
const lodash_1 = require("lodash");
const settings_key_1 = require("../data/settings-key");
const notifications_1 = require("../notifications");
const OS_1 = require("../OS");
const Settings_1 = require("../types/Settings");
const focusListener_1 = require("./focusListener");
const storage_1 = require("./storage");
const SettingNames = {
    COUNT: 'count',
    NAME: 'name',
    MESSAGE: 'message',
};
function filter(text) {
    return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
let sound;
let isEnabled = false;
let lastNotificationDisplayed = null;
let currentNotifications = [];
const debouncedUpdate = (0, lodash_1.debounce)(update, 2000);
const fastUpdate = update;
function clear() {
    currentNotifications = [];
    debouncedUpdate();
}
function fastClear() {
    currentNotifications = [];
    fastUpdate();
}
function enable() {
    const needUpdate = !isEnabled;
    isEnabled = true;
    if (needUpdate) {
        debouncedUpdate();
    }
}
function disable() {
    isEnabled = false;
}
function addNotification(notif) {
    const alreadyThere = currentNotifications.find(n => n.conversationId === notif.conversationId && n.messageId === notif.messageId);
    if (alreadyThere) {
        return;
    }
    currentNotifications.push(notif);
    debouncedUpdate();
}
function addPreviewNotification(notif) {
    currentNotifications.push(notif);
    update(true);
}
function clearByConversationID(convoId) {
    const oldLength = currentNotifications.length;
    currentNotifications = currentNotifications.filter(n => n.conversationId === convoId);
    if (oldLength !== currentNotifications.length) {
        onRemove();
    }
}
function clearByMessageId(messageId) {
    if (!messageId) {
        return;
    }
    const oldLength = currentNotifications.length;
    currentNotifications = currentNotifications.filter(n => n.messageId === messageId);
    if (oldLength !== currentNotifications.length) {
        onRemove();
    }
}
function update(forceRefresh = false) {
    if (lastNotificationDisplayed) {
        lastNotificationDisplayed.close();
        lastNotificationDisplayed = null;
    }
    const isAppFocused = (0, focusListener_1.isWindowFocused)();
    const isAudioNotificationEnabled = storage_1.Storage.get(settings_key_1.SettingsKey.settingsAudioNotification) || false;
    const audioNotificationSupported = (0, Settings_1.isAudioNotificationSupported)();
    const numNotifications = currentNotifications.length;
    const userSetting = getUserSetting();
    const status = (0, notifications_1.getStatus)({
        isAppFocused: forceRefresh ? false : isAppFocused,
        isAudioNotificationEnabled,
        isAudioNotificationSupported: audioNotificationSupported,
        isEnabled,
        numNotifications,
        userSetting,
    });
    if (status.type !== 'ok') {
        if (status.shouldClearNotifications) {
            currentNotifications = [];
        }
        return;
    }
    let title;
    let message;
    let iconUrl;
    const messagesNotificationCount = currentNotifications.length;
    const newMessageCountLabel = `${messagesNotificationCount} ${messagesNotificationCount === 1 ? window.i18n('newMessage') : window.i18n('newMessages')}`;
    if (!currentNotifications.length) {
        return;
    }
    const lastNotification = (0, lodash_1.last)(currentNotifications);
    if (!lastNotification) {
        return;
    }
    switch (userSetting) {
        case SettingNames.COUNT:
            title = 'Session';
            if (messagesNotificationCount > 0) {
                message = newMessageCountLabel;
            }
            else {
                return;
            }
            break;
        case SettingNames.NAME: {
            const lastMessageTitle = lastNotification.title;
            title = newMessageCountLabel;
            iconUrl = lastNotification.iconUrl;
            if (messagesNotificationCount === 1) {
                message = `${window.i18n('notificationFrom')} ${lastMessageTitle}`;
            }
            else {
                message = window.i18n('notificationMostRecentFrom', [lastMessageTitle]);
            }
            break;
        }
        case SettingNames.MESSAGE:
            if (messagesNotificationCount === 1) {
                title = lastNotification.title;
                message = lastNotification.message;
            }
            else {
                title = newMessageCountLabel;
                message = `${window.i18n('notificationMostRecent')} ${lastNotification.message}`;
            }
            iconUrl = lastNotification.iconUrl;
            break;
        default:
            window.log.error(`Error: Unknown user notification setting: '${userSetting}'`);
    }
    const shouldHideExpiringMessageBody = lastNotification.isExpiringMessage && (0, OS_1.isMacOS)();
    if (shouldHideExpiringMessageBody) {
        message = window.i18n('newMessage');
    }
    window.drawAttention();
    if (status.shouldPlayNotificationSound) {
        if (!sound) {
            sound = new Audio('sound/new_message.mp3');
        }
        void sound.play();
    }
    lastNotificationDisplayed = new Notification(title || '', {
        body: window.platform === 'linux' ? filter(message) : message,
        icon: iconUrl || undefined,
        silent: true,
    });
    lastNotificationDisplayed.onclick = () => {
        window.openFromNotification(lastNotification.conversationId);
    };
}
function getUserSetting() {
    return storage_1.Storage.get('notification-setting') || SettingNames.MESSAGE;
}
function onRemove() {
    debouncedUpdate();
}
exports.Notifications = {
    addNotification,
    addPreviewNotification,
    disable,
    enable,
    clear,
    fastClear,
    clearByConversationID,
    clearByMessageId,
};
