'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = __importDefault(require("homey"));
const homey_log_1 = require("homey-log");
const source_map_support_1 = __importDefault(require("source-map-support"));
const zigbee_clusters_1 = require("zigbee-clusters");
source_map_support_1.default.install();
module.exports = class AminaApp extends homey_1.default.App {
    async onInit() {
        this.log('Initializing Amina...');
        this.homeyLog = new homey_log_1.Log({ homey: this.homey });
        if (homey_1.default.env.DEBUG === '1') {
            (0, zigbee_clusters_1.debug)(true);
        }
        const alarmListener = async (args, state) => {
            if (args.description === 'any') {
                return false;
            }
            return args.description === state.description;
        };
        // Register trigger flow cards
        const alarmTriggeredTrigger = this.homey.flow.getDeviceTriggerCard('alarm_triggered');
        const alarmResolvedTrigger = this.homey.flow.getDeviceTriggerCard('alarm_resolved');
        alarmTriggeredTrigger.registerRunListener(alarmListener);
        alarmResolvedTrigger.registerRunListener(alarmListener);
        // Register condition flow cards
        const alarmCondition = this.homey.flow.getConditionCard('alarm_triggered');
        alarmCondition.registerRunListener(async (args) => {
            if (args.description === 'any') {
                return args.device.getCapabilityValue('alarm_status');
            }
            return args.device.currentAlarms.includes(args.description);
        });
        const chargingEnabledCondition = this.homey.flow.getConditionCard('charging_enabled');
        chargingEnabledCondition.registerRunListener(async (args) => args.device.getCapabilityValue('charging_enabled'));
        const chargingPausedCondition = this.homey.flow.getConditionCard('charging_paused');
        chargingPausedCondition.registerRunListener(async (args) => args.device.getCapabilityValue('charging_paused'));
        const evConnectedCondition = this.homey.flow.getConditionCard('ev_connected');
        evConnectedCondition.registerRunListener(async (args) => args.device.getCapabilityValue('ev_connected'));
        const powerDeliveredCondition = this.homey.flow.getConditionCard('power_delivered');
        powerDeliveredCondition.registerRunListener(async (args) => args.device.getCapabilityValue('power_delivered'));
        // Register action flow cards
        const setMaxCurrentAction = this.homey.flow.getActionCard('set_charging_current');
        setMaxCurrentAction.registerRunListener(async (args) => {
            await args.device.setMaxCurrent(args.max);
        });
        this.log('Amina has been initialized');
    }
};
//# sourceMappingURL=app.js.map