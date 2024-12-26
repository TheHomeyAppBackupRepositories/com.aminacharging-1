"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zigbee_clusters_1 = require("zigbee-clusters");
class ExtendedBasicCluster extends zigbee_clusters_1.BasicCluster {
    static get ATTRIBUTES() {
        return {
            ...super.ATTRIBUTES, ...{
                serialNumber: { id: 0x000D, type: zigbee_clusters_1.ZCLDataTypes.string },
            },
        };
    }
}
exports.default = ExtendedBasicCluster;
zigbee_clusters_1.Cluster.addCluster(ExtendedBasicCluster);
//# sourceMappingURL=ExtendedBasicCluster.js.map