import { Dimension, GameMode, ItemStack, Player, world } from "@minecraft/server";
import { overworld } from "./constants";


export function xp(player){
        if(player.getGameMode() !== GameMode.Spectator){
            closestXp(player.dimension,player.location,player)
            giveExperienceForResources(player)
        }
}

export const pickedResource = []

/**定义可用的资源类型 */
export const enabledResources = [
    "bedwars:iron_ingot",
    "bedwars:gold_ingot",
    "bedwars:emerald"
]

/**  定义资源类型和对应的经验值*/
export const resourceExperience = {
    "bedwars:iron_ingot": 1,    // 铁锭
    "bedwars:gold_ingot": 10,   // 金锭
    "bedwars:emerald": 100      // 绿宝石
};

/**
 * 检测玩家背包中是否有指定资源，并提升等级
 * @param {Player} player - 玩家对象
 * @param {string} resourceType - 资源类型（如 "iron"、"gold"、"diamond" 等）
 * @param {number} amount - 需要的资源数量
 */

export function giveExperienceForResources(player) {
        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) return;
        
        let totalXp = 0;
        let hasResources = false;
        
        // 遍历所有槽位
        for (let slot = 0; slot < inventory.size; slot++) {
            const item = inventory.getItem(slot);
            if (!item || !resourceExperience[item.typeId]) continue;
            
            // 确保 item.amount 是数字
            const amount = Number(item.amount);
            if (isNaN(amount)) {
                console.warn(`无效的物品数量: ${item.amount} for ${item.typeId}`);
                continue;
            }
            
            // 计算经验值
            const xpValue = resourceExperience[item.typeId] * amount;
            totalXp += xpValue;
            
            // 清空该槽位
            inventory.setItem(slot, null);
            hasResources = true;
        }
        
        // 添加经验
        if (hasResources && totalXp > 0) {
            // 确保 totalXp 是整数
            const levelsToAdd = Math.floor(totalXp);
            player.addLevels(levelsToAdd);
            player.playSound("random.orb", {location: player.location, volume: 1 });
        }
}

/**
 * 
 * @param {Dimension} dimension 
 * @param {import("@minecraft/server").Vector3} location 
 * @param {Player} player 
 */
export function closestXp(dimension,location,player){
    let resourcesCollected = [];
    dimension.getEntities({location:location,maxDistance:1.7,type:"minecraft:item"}).forEach( item => {
        let type = item.getComponent("minecraft:item").itemStack.typeId
        let count = item.getComponent("minecraft:item").itemStack.amount
        let stack = item.getComponent("minecraft:item").itemStack
        if(resourceExperience[type] === undefined) return;
        player.addLevels(resourceExperience[type]*count);
        player.playSound("random.orb", {location: player.location, volume: 1 });
        resourcesCollected.push(stack)
        item.kill()
    })
    //processInventoryResources(player,resourcesCollected)
}

export function clearResource(player){
    const inventory = player.getComponent("minecraft:inventory").container;
    for (const [resourceId, experience] of Object.entries(resourceExperience)) {
        for (let checkSize=0;checkSize<inventory.size;checkSize++){
            let checkItem=inventory.getItem(checkSize);
            if(checkItem?.id==resourceId){
                inventory.setItem(checkSize, { type: "minecraft:air", count: 1 })
            };
        }
    }
}

export function processInventoryResources(player, collectedResources) {
    const inventory = player.getComponent("minecraft:inventory").container;
    if (!inventory) return;
    
    // 创建资源类型映射
    const resourceMap = {};
    collectedResources.forEach(res => {
        resourceMap[res.typeId] = (resourceMap[res.typeId] || 0) + res.count;
    });
    
    // 遍历背包
    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (!item || !resourceMap[item.typeId]) continue;
        
        const needed = resourceMap[item.typeId];
        if (item.amount <= needed) {
            // 完全移除该槽位的物品
            inventory.setItem(slot, null);
            resourceMap[item.typeId] -= item.amount;
        } else {
            // 部分移除
            inventory.setItem(slot, {
                type: item.typeId,
                amount: item.amount - needed
            });
            resourceMap[item.typeId] = 0;
        }
    }
}