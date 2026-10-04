import { system, CustomCommandParamType } from "@minecraft/server";

let commands = [];
let pendingEnums = new Map();

export function registerCommand(comInfo, callback) {
    let optionalParameters = [], mandatoryParameters = [];
    const namespace = "sh";

    comInfo?.usage.forEach(parameter => {
        const isEnum = Array.isArray(parameter.type);
        
        const paramData = {
            name: parameter.name,
            type: isEnum ? CustomCommandParamType.Enum : parameter.type
        };

        if (isEnum) {
            const enumName = `${namespace}:${comInfo.name}_${parameter.name}_enum`;
            paramData.enumName = enumName;
            pendingEnums.set(enumName, parameter.type);
        }

        if (parameter.optional) {
            optionalParameters.push(paramData);
        } else {
            mandatoryParameters.push(paramData);
        }
    });

    const createCommandObj = (name) => ({
        commandInformation: {
            name: `${namespace}:${name}`,
            description: comInfo?.description,
            permissionLevel: comInfo?.permissionLevel ?? 0,
            cheatsRequired: false,
            optionalParameters: optionalParameters,
            mandatoryParameters: mandatoryParameters
        },
        callback: callback
    });
    comInfo?.aliases?.forEach(alias => {
        commands.push(createCommandObj(alias));
    });

    commands.push(createCommandObj(comInfo?.name));
}

system.beforeEvents.startup.subscribe((init) => {
    const registry = init.customCommandRegistry;

    for (const [name, values] of pendingEnums) {
        try {
            registry.registerEnum(name, values);
        } catch (e) {
            console.warn(`Failed to register enum ${name}: ${e}`);
        }
    }

    for (const command of commands) {
        try {
            registry.registerCommand(command.commandInformation, command.callback);
        } catch (e) {
            console.warn(`Failed to register command ${command.commandInformation.name}: ${e}`);
        }
    }
});