"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alarmIds = void 0;
const zigbee_clusters_1 = require("zigbee-clusters");
const aminaManufacturerId = 0x143B;
exports.alarmIds = ['relayWelded', 'voltageBalanceWrong', 'dcLeakage', 'acLeakage', 'tempError', 'overvoltageWarning', 'undervoltageWarning', 'overcurrentWarning', 'carCommunicationError', 'chargerProcessingError', 'overcurrentCritical'];
class AminaSControlCluster extends zigbee_clusters_1.Cluster {
    static get ID() {
        return 0xFEE7;
    }
    static get NAME() {
        return 'AminaSControl';
    }
    static get ATTRIBUTES() {
        return {
            alarms: { id: 0x0002, type: zigbee_clusters_1.ZCLDataTypes.map16(...exports.alarmIds), manufacturerId: aminaManufacturerId },
            evStatus: { id: 0x0003, type: zigbee_clusters_1.ZCLDataTypes.map16('connected', 'relayActive', 'powerDelivered', 'chargingPaused', 'rfu0', 'rfu1', 'rfu2', 'rfu3', 'rfu4', 'rfu5', 'rfu6', 'rfu7', 'rfu8', 'rfu9', 'rfu10', 'derating'), manufacturerId: aminaManufacturerId },
            connectStatus: { id: 0x0004, type: zigbee_clusters_1.ZCLDataTypes.map16(), manufacturerId: aminaManufacturerId },
            singlePhase: { id: 0x0005, type: zigbee_clusters_1.ZCLDataTypes.uint8, manufacturerId: aminaManufacturerId },
            offlineCurrent: { id: 0x0006, type: zigbee_clusters_1.ZCLDataTypes.uint8, manufacturerId: aminaManufacturerId },
            offlineSinglePhase: { id: 0x0007, type: zigbee_clusters_1.ZCLDataTypes.uint8, manufacturerId: aminaManufacturerId },
            timeToOffline: { id: 0x0008, type: zigbee_clusters_1.ZCLDataTypes.uint16, manufacturerId: aminaManufacturerId },
            enableOffline: { id: 0x0009, type: zigbee_clusters_1.ZCLDataTypes.uint8, manufacturerId: aminaManufacturerId },
            totalActiveEnergy: { id: 0x0010, type: zigbee_clusters_1.ZCLDataTypes.uint32, manufacturerId: aminaManufacturerId },
            lastSessionEnergy: { id: 0x0011, type: zigbee_clusters_1.ZCLDataTypes.uint32, manufacturerId: aminaManufacturerId }, // Not reportable
        };
    }
    static get COMMANDS() {
        // TODO implement SetMaxCurrentLevel command
        return {};
    }
}
exports.default = AminaSControlCluster;
zigbee_clusters_1.Cluster.addCluster(AminaSControlCluster);
//# sourceMappingURL=AminaSControlCluster.js.map