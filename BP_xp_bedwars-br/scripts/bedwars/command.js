import {CommandPermissionLevel,CustomCommandParamType} from "@minecraft/server"
import {makeBot} from "./bot.js"

export function newCommand(init){
    init.customCommandRegistry.registerCommand({
        cheatsRequired:true,
        description:"对服务器bot进行操作.",
        name:"newbot",
        permissionLevel:CommandPermissionLevel.Admin,
        mandatoryParameters:[{name:"生成假人的个数.",type:CustomCommandParamType.Integer}],
        optionalParameters:[{name:"生成假人的名字.",type:CustomCommandParamType.String},{name:"生成假人的行为模式."}]
    },(player,arg)=>{makeBot(player,arg)})
}