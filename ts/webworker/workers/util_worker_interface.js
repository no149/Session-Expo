"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callUtilsWorker = exports.internalCallUtilsWorker = void 0;
const worker_interface_1 = require("../worker_interface");
const path_1 = require("path");
const getRootPath_1 = require("../../node/getRootPath");
let utilWorkerInterface;
const internalCallUtilsWorker = async (fnName, ...args) => {
    if (!utilWorkerInterface) {
        const utilWorkerPath = (0, path_1.join)((0, getRootPath_1.getAppRootPath)(), 'ts', 'webworker', 'workers', 'util.worker.js');
        utilWorkerInterface = new worker_interface_1.WorkerInterface(utilWorkerPath, 3 * 60 * 1000);
    }
    return utilWorkerInterface?.callWorker(fnName, ...args);
};
exports.internalCallUtilsWorker = internalCallUtilsWorker;
const callUtilsWorker = async (fnName, ...args) => {
    return (0, exports.internalCallUtilsWorker)(fnName, ...args);
};
exports.callUtilsWorker = callUtilsWorker;
