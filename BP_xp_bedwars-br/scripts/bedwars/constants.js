import { system, world, Dimension } from "@minecraft/server"

/**
import {
    centerPosition, copyPosition,
    eachPlayer, eachTeam, eachValidPlayer, entityHasItemAmount,
    getEnchantmentLevel, getPlayerAmount, getPlayerNearby, giveItem,
    hasItemTypeTest,
    initPlayer, itemInfo,
    object_print, object_print_actionbar, object_print_actionbar_no_method, object_print_no_method,
    playerIsAlive, playerIsValid,
    randomInt, removeItem, replaceEquipmentItem, replaceInventoryItem, resourceTypeToResourceId,
    secondToMinute, sendMessage,
    teamNameToTeamNumber, teamNumberToTeamName, tickToSecond,
    warnPlayer
} from "./methods"
*/


/** @enum {breakableVanillaBlocksByPlayer[]} 可由玩家破坏的原版方块 */
export const breakableVanillaBlocksByPlayer = [ "minecraft:bed", "minecraft:short_grass", "minecraft:ladder", "minecraft:sponge", "minecraft:wet_sponge", "minecraft:web" ];

/** @enum {breakableVanillaBlocksByExplosion[]} 可由爆炸破坏的原版方块 */
export const breakableVanillaBlocksByExplosion = [ "minecraft:ladder", "minecraft:sponge", "minecraft:wet_sponge", "minecraft:web" ];

/** @enum {dropsFromExplosion[]} 在爆炸中生成掉落物的方块 */
export const dropsFromExplosion = [ "bedwars:end_stone", "bedwars:red_stained_hardened_clay", "bedwars:blue_stained_hardened_clay", "bedwars:yellow_stained_hardened_clay", "bedwars:green_stained_hardened_clay", "bedwars:pink_stained_hardened_clay", "bedwars:cyan_stained_hardened_clay", "bedwars:white_stained_hardened_clay", "bedwars:gray_stained_hardened_clay", "bedwars:purple_stained_hardened_clay", "bedwars:brown_stained_hardened_clay", "bedwars:orange_stained_hardened_clay" ];

/** @enum {resourceType[]} 可用资源类型列表 */
export const resourceType = [ "iron", "gold", "diamond", "emerald" ]

/** @enum {Dimension} 主世界维度 */
/**@type {Dimension}*/export let overworld
system.run(()=>{
    overworld = world.getDimension("overworld")
})

/** @enum {canNotbreakByFireball[]} 烈焰弹不可破坏的方块 */
export const canNotbreakByFireball = [ "bedwars:end_stone", "bedwars:red_stained_hardened_clay", "bedwars:blue_stained_hardened_clay", "bedwars:yellow_stained_hardened_clay", "bedwars:green_stained_hardened_clay", "bedwars:pink_stained_hardened_clay", "bedwars:cyan_stained_hardened_clay", "bedwars:white_stained_hardened_clay", "bedwars:gray_stained_hardened_clay", "bedwars:purple_stained_hardened_clay", "bedwars:brown_stained_hardened_clay", "bedwars:orange_stained_hardened_clay", "bedwars:obsidian"]

/** @type {Function} 等级对应颜色*/
export function colorForLevels( number ) {
    let colors = { 0: "§i", 1: "§r", 2:"§a", 3: "§3", 4: "§b", 5: "§d", 6: "§5", 7: "§p", 8: "§c", 9: "§e" }
    return colors[number] ? colors[number] : "§e"
}

/** @type {import("@minecraft/server").ItemCustomComponent} */
export const DurabilityControllerComponent = {
    /**
     * 当物品击中实体、即将损耗耐久时触发
     * @param {import("@minecraft/server").ItemComponentBeforeDurabilityDamageEvent} event
     */
    onBeforeDurabilityDamage(event) {
        const { itemStack } = event;
        if (!itemStack) return;

        // 指定物品数组
        const targetItems = ["bedwars:seven_deadly_sins"];
        if (!targetItems.includes(itemStack.typeId)) return;

        // 检测物品上有没有耐久附魔
        const enchantable = itemStack.getComponent("minecraft:enchantable");
        if (!enchantable) return;
        const unbreaking = enchantable.getEnchantment("minecraft:unbreaking");
        if (!unbreaking || unbreaking.level <= 0) return;

        const level = unbreaking.level;

        // 公式：3 / (2 * (L + 1)) 概率进行本次耐久损耗
        const chance = 3 / (2 * (level + 1));
        if (Math.random() >= chance) {
            event.durabilityDamage = 0;
        }
    }
};