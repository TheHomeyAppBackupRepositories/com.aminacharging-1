"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zigbee_clusters_1 = require("zigbee-clusters");
class ExtendedLevelControlCluster extends zigbee_clusters_1.LevelControlCluster {
    static get ATTRIBUTES() {
        return {
            ...super.ATTRIBUTES, ...{
                minLevel: { id: 0x0002, type: zigbee_clusters_1.ZCLDataTypes.uint8 },
                maxLevel: { id: 0x0003, type: zigbee_clusters_1.ZCLDataTypes.uint8 },
            },
        };
    }
}
exports.default = ExtendedLevelControlCluster;
zigbee_clusters_1.Cluster.addCluster(ExtendedLevelControlCluster);
//# sourceMappingURL=ExtendedLevelControlCluster.js.map