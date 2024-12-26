"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_zigbeedriver_1 = require("homey-zigbeedriver");
const homey_1 = __importDefault(require("homey"));
const onOff_1 = __importDefault(require("@drenso/homey-zigbee-library/capabilities/onOff"));
const electricalMeasurement_1 = __importDefault(require("@drenso/homey-zigbee-library/capabilities/electricalMeasurement"));
const AminaSControlCluster_1 = __importStar(require("../../lib/AminaSControlCluster"));
const ExtendedBasicCluster_1 = __importDefault(require("../../lib/ExtendedBasicCluster"));
const ExtendedLevelControlCluster_1 = __importDefault(require("../../lib/ExtendedLevelControlCluster"));
const capability_1 = require("@drenso/homey-zigbee-library/lib/helper/capability");
const compare_versions_1 = require("compare-versions");
class AminaSDevice extends homey_zigbeedriver_1.ZigBeeDevice {
    constructor() {
        super(...arguments);
        this.maxChargingLevel = 32;
        this.isSavingSettings = false;
        this.currentAlarms = [];
    }
    async onNodeInit(payload) {
        if (homey_1.default.env.DEBUG === '1') {
            this.enableDebug();
        }
        await super.onNodeInit(payload);
        if (this.getClass() !== 'evcharger') {
            this.setClass('evcharger').catch(this.error);
        }
        // Check firmware version
        const basicParams = await this.zclNode
            .endpoints[this.getClusterEndpoint(ExtendedBasicCluster_1.default) ?? 10]
            .clusters[ExtendedBasicCluster_1.default.NAME]
            .readAttributes(['swBuildId', 'serialNumber'])
            .catch(this.error);
        if (basicParams) {
            await this.setSettings({
                serial: basicParams['serialNumber'],
                firmware_version: basicParams['swBuildId'],
            }).catch(this.error);
            if (basicParams['swBuildId'] !== undefined) {
                const minVer = '1.5.3';
                if (!(0, compare_versions_1.satisfies)(basicParams['swBuildId'], '>=' + minVer)) {
                    await this.setUnavailable(this.homey.__('error.firmware_update_needed', {
                        version: minVer,
                        recommended: '1.8.7',
                    })).catch(this.error);
                    return;
                }
                else {
                    await this.setAvailable().catch(this.error);
                }
            }
        }
        await (0, capability_1.removeCapabilityIfExists)(this, 'measure_voltage');
        await (0, capability_1.removeCapabilityIfExists)(this, 'measure_current');
        // Get maximum charging current
        const levelParams = await this.zclNode.endpoints[this.getClusterEndpoint(ExtendedLevelControlCluster_1.default) ?? 10].clusters[ExtendedLevelControlCluster_1.default.NAME].readAttributes(['currentLevel', 'maxLevel']).catch(this.error);
        if (levelParams && levelParams['maxLevel'] !== undefined) {
            this.maxChargingLevel = levelParams['maxLevel'];
            this.log('Maximum charging level set to', this.maxChargingLevel);
        }
        else {
            this.log('Maximum charging level unknown');
        }
        // Get current charging current set
        if (levelParams && levelParams['currentLevel'] !== undefined) {
            if (!this.isSavingSettings) {
                await this.setSettings({ maxCurrent: levelParams['currentLevel'] }).catch(this.error);
            }
        }
        await (0, onOff_1.default)(this, this.zclNode);
        await (0, electricalMeasurement_1.default)(this, this.zclNode, {
            noPowerFactorReporting: true,
            minMeasurementInterval: 10,
        });
        await this.getPowerUsage();
        // Initialize EV status
        const aminaEndpoint = this.getClusterEndpoint(AminaSControlCluster_1.default) ?? 10;
        const aminaCluster = this.zclNode.endpoints[aminaEndpoint].clusters[AminaSControlCluster_1.default.NAME];
        const onEvStatusReport = async (result) => {
            const flags = result.getBits();
            await this.setCapabilityValue('ev_connected', flags.includes('connected'));
            await this.setCapabilityValue('charging_enabled', flags.includes('relayActive'));
            const powerDelivered = flags.includes('powerDelivered');
            await this.setCapabilityValue('power_delivered', powerDelivered);
            await this.setCapabilityValue('charging_paused', flags.includes('chargingPaused'));
            await this.setAlarm('derating', flags.includes('derating'));
            if (powerDelivered && !this.powerConsumptionInterval) {
                this.powerConsumptionInterval = this.homey.setInterval(() => this.getPowerUsage(), 30000); // Get the power delivered every 30 seconds while charging
            }
            else if (this.powerConsumptionInterval) {
                this.homey.clearInterval(this.powerConsumptionInterval);
            }
            await this.getPowerUsage();
        };
        await aminaCluster.readAttributes(['evStatus']).then(result => onEvStatusReport(result['evStatus'])).catch(this.error);
        // Configure EV status reporting
        await this.configureAttributeReporting([{
                endpointId: aminaEndpoint,
                cluster: AminaSControlCluster_1.default,
                attributeName: 'evStatus',
                minInterval: 10,
                maxInterval: 3600,
                minChange: 1,
            }]).catch(this.error);
        // Handle EV status report
        aminaCluster.on('attr.evStatus', onEvStatusReport);
        // Initialize alarms
        const onAlarmReport = async (result) => {
            const alarms = result.getBits();
            for (const alarm of AminaSControlCluster_1.alarmIds) {
                await this.setAlarm(alarm, alarms.includes(alarm));
            }
        };
        await aminaCluster.readAttributes(['alarms'])
            .then(result => onAlarmReport(result['alarms']))
            .catch(this.error);
        // Configure alarms reporting
        await this.configureAttributeReporting([{
                endpointId: aminaEndpoint,
                cluster: AminaSControlCluster_1.default,
                attributeName: 'alarms',
                minInterval: 10,
                maxInterval: 3600,
                minChange: 1,
            }]).catch(this.error);
        // Handle alarms report
        aminaCluster.on('attr.alarms', onAlarmReport);
        await this.updateAlarm();
        // Sync settings
        await aminaCluster
            .readAttributes(['offlineCurrent', 'timeToOffline', 'enableOffline'])
            .then(result => this.copySettingsFromDevice(result)).catch(this.error);
    }
    async copySettingsFromDevice(deviceSettings) {
        if (this.isSavingSettings) {
            return;
        }
        this.debug('Copy settings from device', deviceSettings);
        const homeySettings = {};
        if (deviceSettings.offlineCurrent !== undefined && deviceSettings.offlineCurrent !== null) {
            homeySettings.offlineCurrent = deviceSettings.offlineCurrent;
        }
        else {
            this.log('Setting offline current to max charging level since it is not set');
            homeySettings.offlineCurrent = this.maxChargingLevel;
            await this.writeSettings({ offlineCurrent: this.maxChargingLevel }, AminaSControlCluster_1.default);
        }
        if (deviceSettings.timeToOffline !== undefined && deviceSettings.timeToOffline !== null) {
            homeySettings.timeToOffline = deviceSettings.timeToOffline;
        }
        if (deviceSettings.enableOffline !== undefined && deviceSettings.enableOffline !== null) {
            homeySettings.enableOffline = deviceSettings.enableOffline === 1;
        }
        if (Object.keys(homeySettings).length > 0) {
            this.debug('Parsed copy settings from device', homeySettings);
            await this.setSettings(homeySettings).catch(this.error);
        }
    }
    async setAlarm(alarm, value) {
        if (value) {
            if (!this.currentAlarms.includes(alarm)) {
                this.currentAlarms.push(alarm);
                await this.triggerFlow({
                    id: 'alarm_triggered',
                    state: { description: alarm },
                    tokens: { description: alarm },
                }).catch(this.error);
                await this.updateAlarm();
            }
        }
        else {
            if (this.currentAlarms.includes(alarm)) {
                this.currentAlarms.splice(this.currentAlarms.indexOf(alarm), 1);
                await this.triggerFlow({
                    id: 'alarm_resolved',
                    state: { description: alarm },
                    tokens: { description: alarm },
                }).catch(this.error);
                await this.updateAlarm();
            }
        }
    }
    async onUninit() {
        if (this.powerConsumptionInterval) {
            this.homey.clearInterval(this.powerConsumptionInterval);
        }
    }
    async onSettings({ newSettings, changedKeys }) {
        this.debug('AminaSDevice settings were changed', newSettings, changedKeys);
        if (this.zclNode === undefined || this.zclNode === null) {
            throw new Error('Could not save settings, try again later.');
        }
        this.isSavingSettings = true;
        const newAminaSettings = {};
        for (const changedKey of changedKeys) {
            switch (changedKey) {
                case 'maxCurrent':
                    await this.setMaxCurrent(newSettings.maxCurrent);
                    break;
                case 'offlineCurrent':
                    newAminaSettings.offlineCurrent = newSettings.offlineCurrent;
                    break;
                case 'timeToOffline':
                    newAminaSettings.timeToOffline = newSettings.timeToOffline;
                    break;
                case 'enableOffline':
                    newAminaSettings.enableOffline = newSettings.enableOffline;
                    break;
            }
        }
        await this.writeSettings(newAminaSettings, AminaSControlCluster_1.default);
        this.isSavingSettings = false;
    }
    async writeSettings(newSettings, cluster) {
        if (Object.keys(newSettings).length > 0) {
            this.debug('Parsed write settings to device', newSettings);
            const endpoint = this.getClusterEndpoint(cluster);
            if (!endpoint) {
                this.error('Cluster endpoint not found!');
                return;
            }
            await this.zclNode
                .endpoints[endpoint]
                .clusters[cluster.NAME]
                .writeAttributes(newSettings);
        }
    }
    async setMaxCurrent(maxCurrent) {
        maxCurrent = Math.round(maxCurrent);
        this.log('Checking allowed max current, setting is', maxCurrent);
        if (maxCurrent > this.maxChargingLevel) {
            this.error('Max current exceeded', this.maxChargingLevel);
            throw new Error(this.homey.__('error.current_more_than_max', { maxCurrent: this.maxChargingLevel }));
        }
        if (maxCurrent < 6) {
            this.error('Current smaller than 6A, not setting');
            throw new Error(this.homey.__('error.current_smaller_than_min'));
        }
        this.log('Updating max current to', maxCurrent);
        await this.zclNode
            .endpoints[this.getClusterEndpoint(ExtendedLevelControlCluster_1.default) ?? 10]
            .clusters[ExtendedLevelControlCluster_1.default.NAME]
            .moveToLevel({ level: maxCurrent, transitionTime: 0 });
    }
    async getPowerUsage() {
        await this.zclNode.endpoints[this.getClusterEndpoint(AminaSControlCluster_1.default) ?? 10].clusters[AminaSControlCluster_1.default.NAME].readAttributes(['totalActiveEnergy', 'lastSessionEnergy']).then(result => {
            this.setCapabilityValue('total_energy', result['totalActiveEnergy'] / 1000);
            this.setCapabilityValue('last_session_energy', result['lastSessionEnergy'] / 1000);
        }).catch(this.error);
    }
    async updateAlarm() {
        if (this.currentAlarms.length === 0) {
            await this.setCapabilityValue('alarm_status', false).catch(this.error);
            await this.setCapabilityValue('alarm_description', this.homey.__('alarm.no_alarm')).catch(this.error);
            return;
        }
        await this.setCapabilityValue('alarm_status', true).catch(this.error);
        await this.setCapabilityValue('alarm_description', this.currentAlarms.map(alarm => this.homey.__('alarm.' + alarm)).join(', ')).catch(this.error);
    }
}
exports.default = AminaSDevice;
module.exports = AminaSDevice;
//# sourceMappingURL=device.js.map