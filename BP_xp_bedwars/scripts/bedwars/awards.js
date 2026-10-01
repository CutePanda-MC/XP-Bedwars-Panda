import { world, system, Player } from "@minecraft/server";
import { loadXpofPlayer, showTitle } from "./methods.js";

/**
 * 给玩家货币奖励
 * @param {Player} player 
 * @param {String} type 
 * @param {Number} amount 
 */
export function award( player, type, amount ) {
    switch ( type ) {
        case "coin":
            if( player.getDynamicProperty("coin") ){
                player.setDynamicProperty("coin", player.getDynamicProperty("coin") + amount)
                player.playSound("note.pling", { location: player.location, volume: 2 })
                player.sendMessage(`§b+ §e${amount} §7起床硬币`)
            }else{
                player.setDynamicProperty("coin", amount)
                player.playSound("note.pling", { location: player.location, volume: 2 })
                player.sendMessage(`§b+ §e${amount} §7起床硬币`)
            }
            break;
        case "xp":
            if( player.getDynamicProperty("xp") ){
                player.setDynamicProperty("xp", player.getDynamicProperty("xp") + amount)
                player.playSound("random.orb", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §q起床战争经验`)
            }else{
                player.setDynamicProperty("xp", amount)
                player.playSound("random.orb", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §q起床战争经验`)
            }
            break;
        case "amethyst":
            if( player.getDynamicProperty("amethyst") ){
                player.setDynamicProperty("amethyst", player.getDynamicProperty("amethyst") + amount)
                player.playSound("fall.amethyst_block", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §d紫水晶`)
            }else{
                player.setDynamicProperty("amethyst", amount)
                player.playSound("fall.amethyst_block", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §d紫水晶`)
            }
            break;
        case "diamond":
            if( player.getDynamicProperty("diamond") ){
                player.setDynamicProperty("diamond", player.getDynamicProperty("diamond") + amount)
                player.playSound("random.pop", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §b钻石`)
            }else{
                player.setDynamicProperty("diamond", amount)
                player.playSound("random.pop", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §b钻石`)
            }
            break;
        case "stardust":
            if( player.getDynamicProperty("stardust") ){
                player.setDynamicProperty("stardust", player.getDynamicProperty("stardust") + amount)
                player.playSound("beacon.power", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §e星尘`)
            }else{
                player.setDynamicProperty("stardust", amount)
                player.playSound("beacon.power", { location: player.location, volume: 1 })
                player.sendMessage(`§b+ §e${amount} §e星尘`)
            }
            break;

    }
    showTitle( player, "", "", { onlyUpdate: true } )
    loadXpofPlayer( player )
}

/**
 * 扣除玩家货币
 * @param {Player} player 
 * @param {String} type 
 * @param {Number} amount 
 */
export function take( player, type, amount ) {
    switch ( type ) {
        case "coin":
            if( player.getDynamicProperty("coin") ){
                player.setDynamicProperty("coin", player.getDynamicProperty("coin") - amount)
                player.playSound("note.pling", { location: player.location, volume: 2 })
                player.sendMessage(`§b- §e${amount} §7起床硬币`)
            }else{
                player.setDynamicProperty("coin", -amount)
                player.playSound("note.pling", { location: player.location, volume: 2 })
                player.sendMessage(`§b- §e${amount} §7起床硬币`)
            }
            break;
        case "xp":
            if( player.getDynamicProperty("xp") ){
                player.setDynamicProperty("xp", player.getDynamicProperty("xp") - amount)
                player.playSound("random.orb", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §q起床战争经验`)
            }else{
                player.setDynamicProperty("xp", -amount)
                player.playSound("random.orb", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §q起床战争经验`)
            }
            break;
        case "amethyst":
            if( player.getDynamicProperty("amethyst") ){
                player.setDynamicProperty("amethyst", player.getDynamicProperty("amethyst") - amount)
                player.playSound("fall.amethyst_block", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §d紫水晶`)
            }else{
                player.setDynamicProperty("amethyst", -amount)
                player.playSound("fall.amethyst_block", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §d紫水晶`)
            }
            break;
        case "diamond":
            if( player.getDynamicProperty("diamond") ){
                player.setDynamicProperty("diamond", player.getDynamicProperty("diamond") - amount)
                player.playSound("random.pop", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §b钻石`)
            }else{
                player.setDynamicProperty("diamond", -amount)
                player.playSound("random.pop", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §b钻石`)
            }
            break;
        case "stardust":
            if( player.getDynamicProperty("stardust") ){
                player.setDynamicProperty("stardust", player.getDynamicProperty("stardust") - amount)
                player.playSound("beacon.power", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §e星尘`)
            }else{
                player.setDynamicProperty("stardust", -amount)
                player.playSound("beacon.power", { location: player.location, volume: 1 })
                player.sendMessage(`§b- §e${amount} §e星尘`)
            }
            break;

    }
    showTitle( player, "", "", { onlyUpdate: true } )
    loadXpofPlayer( player )
}

/**
 * 设置玩家货币
 * @param {Player} player 
 * @param {String} type 
 * @param {Number} amount 
 */
export function set( player, type, amount ) {
    switch ( type ) {
        case "coin":
            if( player.getDynamicProperty("coin") ){
                player.setDynamicProperty("coin", amount)
                player.playSound("note.pling", { location: player.location, volume: 2 })
                player.sendMessage(`您的 §7起床硬币 §r已被§b设置§r为 §e${amount}`)
            }else{
                player.setDynamicProperty("coin", amount)
                player.playSound("note.pling", { location: player.location, volume: 2 })
                player.sendMessage(`您的 §7起床硬币 §r已被§b设置§r为 §e${amount}`)
            }
            break;
        case "xp":
            if( player.getDynamicProperty("xp") ){
                player.setDynamicProperty("xp", amount)
                player.playSound("random.orb", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §q起床战争经验 §r已被§b设置§r为 §e${amount}`)
            }else{
                player.setDynamicProperty("xp", amount)
                player.playSound("random.orb", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §q起床战争经验 §r已被§b设置§r为 §e${amount}`)
            }
            break;
        case "amethyst":
            if( player.getDynamicProperty("amethyst") ){
                player.setDynamicProperty("amethyst", amount)
                player.playSound("fall.amethyst_block", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §d紫水晶 §r已被§b设置§r为 §e${amount}`)
            }else{
                player.setDynamicProperty("amethyst", amount)
                player.playSound("fall.amethyst_block", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §d紫水晶 §r已被§b设置§r为 §e${amount}`)
            }
            break;
        case "diamond":
            if( player.getDynamicProperty("diamond") ){
                player.setDynamicProperty("diamond", amount)
                player.playSound("random.pop", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §b钻石 §r已被§b设置§r为 §e${amount}`)
            }else{
                player.setDynamicProperty("diamond", amount)
                player.playSound("random.pop", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §b钻石 §r已被§b设置§r为 §e${amount}`)
            }
            break;
        case "stardust":
            if( player.getDynamicProperty("stardust") ){
                player.setDynamicProperty("stardust", amount)
                player.playSound("beacon.power", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §e星尘 §r已被§b设置§r为 §e${amount}`)
            }else{
                player.setDynamicProperty("stardust", amount)
                player.playSound("beacon.power", { location: player.location, volume: 1 })
                player.sendMessage(`您的 §e星尘 §r已被§b设置§r为 §e${amount}`)
            }
            break;

    }
    showTitle( player, "", "", { onlyUpdate: true } )
    loadXpofPlayer( player )
}