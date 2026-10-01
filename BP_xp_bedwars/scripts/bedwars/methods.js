// 起床战争队伍类

import { world, system, Player, ItemStack, Entity, EnchantmentType, EquipmentSlot, Container, ScoreboardObjective, GameMode, ItemLockMode } from "@minecraft/server"
import { ActionFormData, CustomForm, ModalFormData } from "@minecraft/server-ui";
import { overworld, resourceType, colorForLevels } from "./constants.js"
import { map } from "./maps.js"
import { BedwarsTeam } from "./team.js";
import { categories,categorySign, maxRotatingItems, teamCategorySign, teamUpgradeShopitems } from "./shopitem.js";
import { equipmentFunction, respawnFunction } from "./events.js";
import { GameSystem } from "./system.js";
import { take } from "./awards.js";

/**上一个title */
export let lastTitle = {"title": "", "subtitle": "", "time": 0, "duration": 0, "fadeInDuration": 0, "fadeOutDuration": 0};

// ===== 常用方法区 =====

/**
 * 递归地将对象/数组规范化为字符串（键排序，保证相同内容输出相同字符串）
 */
export function normalize(value) {
    if (value === null || typeof value !== 'object') {
        return String(value); // 基本类型直接转字符串
    }
    if (Array.isArray(value)) {
        // 数组：对每个元素递归规范化，然后整体排序（保持数组内容顺序无关）
        const normalizedArray = value.map(item => normalize(item));
        // 对数组元素排序，使得 [1,2] 和 [2,1] 输出一致（假设数组内容无序）
        normalizedArray.sort();
        return `[${normalizedArray.join(',')}]`;
    }
    // 对象：提取键并排序，构建 {k1:v1, k2:v2} 形式
    const sortedKeys = Object.keys(value).sort();
    const objParts = sortedKeys.map(k => `${k}:${normalize(value[k])}`);
    return `{${objParts.join(',')}}`;
}

/**
 * 判断两个数组是否包含相同的元素（忽略顺序，深度比较对象）
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @returns {boolean}
 */
export function areArraysEqualUnordered(arr1, arr2) {
    if ( !arr1 && !arr2 ) return true;
    if( !arr1 || !arr2 ) return false;
    if( !Array.isArray(arr1) || !Array.isArray(arr2) ) return false;
    if( arr1.length === 0 && arr2.length === 0 ) return true;
    if (arr1.length !== arr2.length) return false;

    const countMap = new Map();

    // 统计 arr1 中每个规范化字符串的出现次数
    for (const item of arr1) {
        const key = normalize(item);
        countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    // 遍历 arr2，减去计数
    for (const item of arr2) {
        const key = normalize(item);
        const remaining = (countMap.get(key) || 0) - 1;
        if (remaining < 0) return false; // 出现次数过多或不存在
        if (remaining === 0) {
            countMap.delete(key);
        } else {
            countMap.set(key, remaining);
        }
    }

    return countMap.size === 0;
}

/**
 * 深度比较两个值是否相等（支持对象、数组、基本类型）
 */
export function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
}

/**
 * 比较两个数组是否有序且内容深度相等
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @returns {boolean}
 */
export function areArraysEqualOrdered(arr1, arr2) {
    if ( !arr1 && !arr2 ) return true;
    if( !arr1 || !arr2 ) return false;
    if( !Array.isArray(arr1) || !Array.isArray(arr2) ) return false;
    if( arr1.length === 0 && arr2.length === 0 ) return true;
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (!deepEqual(arr1[i], arr2[i])) return false;
    }
    return true;
}

/**
 * 将对象或数组编码为 JSON 字符串
 * @param {*} data - 要序列化的数据（对象、数组等）
 * @param {boolean} [pretty=false] - 是否格式化输出（多行缩进）
 * @returns {string} JSON 字符串
 */
export function encodeToJsonString(data, pretty = false) {
    if(!data) return undefined;
    try {
        if (pretty) {
            return JSON.stringify(data, null, 2);
        }
        return JSON.stringify(data);
    } catch (error) {
        console.error('JSON 编码失败:', error);
        return '{}'; // 或抛出错误，视情况而定
    }
}

/**
 * 将 JSON 字符串解码为对象或数组
 * @param {string} jsonString - 合法的 JSON 字符串
 * @param {*} [defaultValue=null] - 解析失败时返回的默认值
 * @returns {*} 解析后的数据，或默认值
 */
export function decodeFromJsonString(jsonString, defaultValue = undefined) {
    if(!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('JSON 解码失败:', error);
        return defaultValue;
    }
}

/**
 * 返回字符串的 UTF-8 编码字节数
 * @param {string} str
 * @returns {number}
 */
function getUtf8ByteLength(str) {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x7F) {
            len += 1;                // 1 字节：ASCII
        } else if (code <= 0x7FF) {
            len += 2;                // 2 字节：拉丁扩展、希腊文、§ 等
        } else if (code >= 0xD800 && code <= 0xDBFF) {
            // 高位代理对（比如 emoji），占 4 字节，需要跳过下一个低位代理
            len += 4;
            i++;                     // 跳过低位代理
        } else {
            len += 3;                // 3 字节：汉字、日韩文等（BMP 内其他字符）
        }
    }
    return len;
}

/** 在a~b之间取随机整数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 */
export function randomInt(min, max) {
    /** 确保 min <= max */
    if (min > max) { [min, max] = [max, min]; }
    return Math.floor(Math.random() * (max - min + 1)) + min;    // 生成 [min, max] 之间的随机整数
}

/** 将单位为刻的时间转换为以秒为单位的时间
 * @param {Number} tickTime 
 */
export function tickToSecond( tickTime ) {
    return Math.ceil( tickTime / 20 );
}

/** 将单位为秒的时间转换为以分钟为单位的时间，且可以直接返回字符串
 * @param {Number} secondTime - 时间值，单位：秒
 * @param {"string" | "value"} returnType - 返回类型
 */
export function secondToMinute( secondTime, returnType = "value" ) {
    let minute = Math.floor( secondTime / 60 );
    let second = secondTime - 60 * minute;
    if ( returnType === "string" ) {
        if ( second >= 0 && second < 10 ) { return `${minute}:0${second}` } else { return `${minute}:${second}` }
    }
    else { return { minute: minute, second: second } }
}

/**
 * [方法类] 生成一个半径为1的粒子圈
 * @param {*} x 
 * @param {*} y 
 * @param {*} z 
 * @param {*} particle
 * @param {*} player
 */
export function particleCircle(x,y,z,particle,player){
    for(let sita =0;sita <= 90;sita+=10){
        let addX = Math.sin(sita)
        let addZ = Math.cos(sita)
        if(sita!=0){
            player.runCommand(`particle ${particle} ${x+addX} ${y} ${z+addZ}`)
            player.runCommand(`particle ${particle} ${x-addX} ${y} ${z+addZ}`)
        }
        if(sita!=90){
            player.runCommand(`particle ${particle} ${x+addX} ${y} ${z+addZ}`)
            player.runCommand(`particle ${particle} ${x+addX} ${y} ${z-addZ}`)
        }
    }
}

/**
 * 坐标相加
 * @param {import("@minecraft/server").Vector3} pos1 
 * @param {import("@minecraft/server").Vector3} pos2 
 * @returns {import("@minecraft/server").Vector3}
 */
export function posPlus( pos1,pos2 ){
    return { x: pos1.x + pos2.x, y: pos1.y + pos2.y, z: pos1.z + pos2.z }
}

/** 获取玩家数目
 * @returns 玩家数目
 */
export function getPlayerAmount() {
    return world.getPlayers().length;
};

/** 检查输入的玩家是否有起床战争信息
 * @param {Player} player 
 */
export function playerIsValid( player ) {
    return player.bedwarsInfo !== undefined
}

/** 检查输入的玩家是否有起床战争信息，并且存活
 * @param {Player} player 
 */
export function playerIsAlive( player ) {
    return player.bedwarsInfo !== undefined && player.bedwarsInfo.deathState.isDeath !== true
}

/**
 * 格式化数字，将其转换为特定的字符串表示形式
 * @param {Number} num 
 * @returns {String}
 */
export function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '___'; // 异常情况

    // 小于1万：直接显示整数部分，补全
    if (num < 10000) {
        let s = String(Math.floor(num));
        if (s.length < 5) s = s + '_'.repeat(5 - s.length);
        return s;
    }

    // 确定单位与后缀
    const threshold = num >= 100000000 ? 100000000 : 10000;
    const suffix = num >= 100000000 ? 'e' : 'w';

    let value = num / threshold;
    const intDigits = String(Math.floor(value)).length; // 整数部分位数

    let result;
    if (intDigits >= 3) {
        // 整数部分已有3位或更多，直接取整（向下）
        result = String(Math.floor(value));
    } else {
        // 需要小数补足到总共3位
        const decimals = 3 - intDigits;
        const factor = Math.pow(10, decimals);
        const fixed = Math.floor(value * factor) / factor;
        if (fixed % 1 === 0) {
            result = String(fixed); // 恰好整数，去掉 .0
        } else {
            result = fixed.toFixed(decimals); // 显示指定小数位数，保证尾随零正确
        }
    }

    result = result + suffix;

    // 右侧补全下划线至长度5
    if (result.length < 5) {
        result = result + '_'.repeat(5 - result.length);
    }
    return result;
}

/** 对特定玩家展示标题和副标题（作为原版API的重写）
 * @param {Player} player 
 * @param {String | import("@minecraft/server").RawMessage} title 
 * @param {String | import("@minecraft/server").RawMessage} subtitle 
 * @param {{
 * fadeInDuration: Number,
 * stayDuration: Number,
 * fadeOutDuration: Number,
 * onlyUpdate: Boolean
 * }} options 
 */
export function showTitle( player, title, subtitle = "", options = {} ) {
    const defaultOptions = { fadeInDuration: 10, stayDuration: 70,  fadeOutDuration: 20, onlyUpdate: false }
    const allOptions = { ...defaultOptions, ...options }
    if(allOptions.onlyUpdate){
        let remainTime = (lastTitle.time + lastTitle.fadeInDuration + lastTitle.duration + lastTitle.fadeOutDuration) - system.currentTick
        if( remainTime > 0 ) {
            title = lastTitle.title + `§7${formatNumber(player.getDynamicProperty("coin") || 0)}§b${formatNumber(player.getDynamicProperty("diamond") || 0)}§e${formatNumber(player.getDynamicProperty("stardust") || 0)}`
            subtitle = lastTitle.subtitle
            allOptions.fadeInDuration = lastTitle.fadeInDuration <= remainTime-lastTitle.duration-lastTitle.fadeOutDuration ? lastTitle.fadeInDuration : Math.max(0, remainTime - lastTitle.duration - lastTitle.fadeOutDuration)
            allOptions.stayDuration = lastTitle.duration <= remainTime-lastTitle.fadeOutDuration ? lastTitle.duration : Math.max(0, remainTime - lastTitle.fadeOutDuration)
            allOptions.fadeOutDuration = lastTitle.fadeOutDuration <= remainTime ? lastTitle.fadeOutDuration : remainTime
        }else{
            title = "_".repeat(48) + `§7${formatNumber(player.getDynamicProperty("coin") || 0)}§b${formatNumber(player.getDynamicProperty("diamond") || 0)}§e${formatNumber(player.getDynamicProperty("stardust") || 0)}`
            allOptions.fadeInDuration = 0
            allOptions.stayDuration = 0
            allOptions.fadeOutDuration = 0
        }
    }else{
        if(getUtf8ByteLength(title) >= 48){ 
            title = title.slice(0,48)
        }else{
            title = title + '_'.repeat(48-getUtf8ByteLength(title))
        }
        title += `§7${formatNumber(player.getDynamicProperty("coin") || 0)}§b${formatNumber(player.getDynamicProperty("diamond") || 0)}§e${formatNumber(player.getDynamicProperty("stardust") || 0)}`
    }
    player.onScreenDisplay.setTitle( title, { fadeInDuration: allOptions.fadeInDuration, stayDuration: allOptions.stayDuration, fadeOutDuration: allOptions.fadeOutDuration, subtitle: subtitle } );
}

/** 警告玩家（播放音效）
 * @param {Player} player - 玩家信息
 * @param {import("@minecraft/server").RawMessage} rawtext - 输入的 rawtext
 */
export function warnPlayer( player, rawtext ) {
    player.playSound( "mob.shulker.teleport", { pitch: 0.5, location: player.location } );
    player.sendMessage( rawtext );
};

/** 获取在特定的位置附近是否有玩家
 * @param {import("@minecraft/server").Vector3} pos - 获取特定位置
 * @param {number} r - 检测位置附近的半径
 * @returns 返回玩家信息，或返回 false
 */
export function getPlayerNearby( pos, r ) {
    return overworld.getPlayers( { location: pos, maxDistance: r } )
}

/** 复制坐标，但不影响原有的坐标
 * @param {import("@minecraft/server").Vector3} pos - 坐标
 * @returns {import("@minecraft/server").Vector3} 返回复制的坐标
 */
export function copyPosition( pos ) {
    return { x: pos.x, y: pos.y, z: pos.z }
}

/**
 * 计算两个向量之间的平方距离（低开销，避免使用 Math.sqrt）
 * @param {import("@minecraft/server").Vector3} a
 * @param {import("@minecraft/server").Vector3} b
 * @returns {number} 返回平方距离（distance^2）
 */
export function distanceSquared( a, b ) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

/**
 * 判断两个向量之间的距离是否小于等于给定值（使用平方比较以减少开销）
 * @param {import("@minecraft/server").Vector3} a
 * @param {import("@minecraft/server").Vector3} b
 * @param {number} maxDistance
 * @returns {boolean}
 */
export function isWithinDistance( a, b, maxDistance ) {
    if ( typeof maxDistance !== 'number' || isNaN(maxDistance) ) return false;
    return distanceSquared( a, b ) <= ( maxDistance * maxDistance );
}

/**
 * 伤害检测，测试
 * @param {Player} player 
 * @param {Number} damage 
 */
export function damageTest( player, damage, damageType ) {
    /**@type {BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
    let armorValue = player.getComponent("minecraft:equippable").totalArmor
    let toughnessValue = player.getComponent("minecraft:equippable").totalToughness
    let protectionEPF = playerInfo.getTeam().teamUpgrade.reinforcedArmor * 4
    let resistanceLevel = player.getEffect("minecraft:resistance")?.amplifier == undefined ? 0 : player.getEffect("minecraft:resistance").amplifier+1

    //world.sendMessage(`伤害类型：${damageType}，基础伤害：${damage}，护甲值：${armorValue}，韧性值：${toughnessValue}，EPF：${protectionEPF}，抗性等级：${resistanceLevel}`)
    let armorFactor = damageType === "fall" ? 1 : 1 - (Math.min(20, Math.max(armorValue * 0.2, armorValue - damage / (2 + toughnessValue * 0.25))) / 25)
    let enchantFactor = 1 - Math.min(20, protectionEPF) / 25;
    let resistanceFactor = resistanceLevel >= 5 ? 0 : 1 - 0.2 * resistanceLevel;

    let finalDamage = damage * armorFactor * enchantFactor * resistanceFactor;
    return finalDamage;
}

/**
 * 返回原伤害
 * @param {Player} player 
 * @param {Number} damage 
 */
export function sourceDamage( player, damage, damageType ) {
    /**@type {BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
    let armorValue = player.getComponent("minecraft:equippable").totalArmor
    let toughnessValue = player.getComponent("minecraft:equippable").totalToughness
    let protectionEPF = playerInfo.getTeam().teamUpgrade.reinforcedArmor * 4
    let resistanceLevel = player.getEffect("minecraft:resistance")?.amplifier == undefined ? 0 : player.getEffect("minecraft:resistance").amplifier+1

    //world.sendMessage(`伤害类型：${damageType}，基础伤害：${damage}，护甲值：${armorValue}，韧性值：${toughnessValue}，EPF：${protectionEPF}，抗性等级：${resistanceLevel}`)
    let armorFactor = damageType === "fall" ? 1 :  1 - (Math.min(20, Math.max(armorValue * 0.2, armorValue - damage / (2 + toughnessValue * 0.25))) / 25)
    let enchantFactor = 1 - Math.min(20, protectionEPF) / 25;
    let resistanceFactor = resistanceLevel >= 5 ? 0 : 1 - 0.2 * resistanceLevel;

    let finalDamage = damage / armorFactor / enchantFactor / resistanceFactor;
    return finalDamage;
}

/**
 * @param {Entity} trader 
 */
export function setTraderItemPlus_item(trader){
    let inv = trader.getComponent("minecraft:inventory").container;
    let traderTags = trader.getTags();
    let playerTag = traderTags.find(t => world.getPlayers({ name: t }).length > 0);
    let page = 1;
    let Pcategory = 0;
    const pl = world.getPlayers({ name: playerTag })[0];
    if (pl && pl.bedwarsInfo) Pcategory = pl.bedwarsInfo.category[0];
    if (pl && pl.bedwarsInfo) page = pl.bedwarsInfo.page[0];

    categories.forEach((category, index) => {
        // Ensure category icon in slots 0..8
        const icon = itemInfo(category[0], {
            amount: page,
            lore: index === Pcategory ? [`§r页码: ${page}/${Math.ceil((category.length - 1) / 18)}`, "点击以切换页码"] : []
        });
        const existingIcon = inv.getItem(index);
        if (!existingIcon || existingIcon.typeId !== category[0] || existingIcon.amount !== icon.amount) inv.setItem(index, icon);

        if (index !== Pcategory) return; // Only populate items for active category

        // Build list of items to display (excluding the category icon at index 0)
        let allItems = category.slice(1);
        let itemsToShow = [];

        // If the category is tools (index 3), stack items by type and tier
        if (Pcategory === 3 && pl && pl.bedwarsInfo) {
            const equip = pl.bedwarsInfo.equipment || {};
            const maxTierByType = {};

            // Calculate the maximum tier for each item type
            allItems.forEach(item => {
                const tier = Number(item.tier) || 0;
                const type = item.itemType;
                if (tier > 0) {
                    if (!maxTierByType[type] || tier > maxTierByType[type]) {
                        maxTierByType[type] = tier;
                    }
                }
            });

            // Filter items to show only the next tier or the highest tier if already maxed
            allItems.forEach(item => {
                const tier = Number(item.tier) || 0;
                const type = item.itemType;
                const playerLevel = Number(equip[type]) || 0;

                if (tier > 0) {
                    if (tier === playerLevel + 1 || (playerLevel >= (maxTierByType[type] || 0) && tier === maxTierByType[type])) {
                        itemsToShow.push(item);
                    }
                } else {
                    itemsToShow.push(item);
                }
            });

            // Remove duplicates based on shopitemId
            const seen = new Set();
            itemsToShow = itemsToShow.filter(item => {
                const id = item.shopitemId || JSON.stringify(item);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }else if(Pcategory === 8 && pl && pl.bedwarsInfo){
            /**@type {BedwarsTeam} */
            let team = pl.bedwarsInfo.getTeam();
            allItems = allItems.slice(0,team.teamUpgrade.rotatingPlus+1);
            allItems.push(...Array(maxRotatingItems - team.teamUpgrade.rotatingPlus-1).fill(
                itemInfo("bedwars:prohibited", { lore: ["§r§e前往团队升级处解锁此槽位!"] })
            ))
            itemsToShow = allItems.slice();
        }else {
            itemsToShow = allItems.slice();
        }

        const expectedCount = Math.max(0, itemsToShow.length);

        // Fill border with bedwars:divider
        const borderSlots = [
            ...Array.from({ length: 9 }, (_, i) => 9 + i), // Top border
            ...Array.from({ length: 9 }, (_, i) => 45 + i), // Bottom border
            ...Array.from({ length: 4 }, (_, i) => 18 + i * 9), // Left border
            ...Array.from({ length: 4 }, (_, i) => 26 + i * 9) // Right border
        ];
        borderSlots.forEach(slot => {
            const existing = inv.getItem(slot);
            if( slot === 9 + Pcategory ) return;
            if (!existing || existing.typeId !== "bedwars:divider") {
                const dividerItem = itemInfo("bedwars:divider", {});
                inv.setItem(slot, dividerItem);
            }
        });

        // Fill selected category slot with bedwars:selected_divider
        const selectedSlot = 9 + Pcategory;
        const existingSelected = inv.getItem(selectedSlot);
        if (!existingSelected || existingSelected.typeId !== "bedwars:selected_divider") {
            const selectedDividerItem = itemInfo("bedwars:selected_divider", {});
            inv.setItem(selectedSlot, selectedDividerItem);
        }

        // Display items within the bordered area (slots 19-25, 28-34, 37-43)
        const displaySlots = [
            ...Array.from({ length: 7 }, (_, i) => 19 + i),
            ...Array.from({ length: 7 }, (_, i) => 28 + i),
            ...Array.from({ length: 7 }, (_, i) => 37 + i)
        ];

        let startIndex = (page - 1) * 18;
        for (let i = 0; i < displaySlots.length; i++) {
            const globalIndex = startIndex + i;
            const slot = displaySlots[i];
            const shopItem = itemsToShow[globalIndex];
            if (shopItem) {
                if(shopItem.typeId){
                    const existing = inv.getItem(slot);
                    if (!existing || existing.typeId !== shopItem.typeId) {
                        inv.setItem(slot, shopItem);
                    }
                }else{
                    const amount = shopItem.itemAmount || 1;
                    const lore = typeof shopItem.generateLore === 'function' ? shopItem.generateLore() : (shopItem.description ? ["", shopItem.description] : []);
                    const name = shopItem.itemName;
                    const existing = inv.getItem(slot);
                    // Only set if empty or different type
                    if (!existing || existing.typeId !== shopItem.shopitemId) {
                        inv.setItem(slot, itemInfo(shopItem.shopitemId, { amount: amount, lore: lore, name: name }));
                    }
                }
            } else {
                // Clear slot if it contains a stale shop item
                const existing = inv.getItem(slot);
                if (existing && (existing.typeId.includes('bedwars:shopitem_') || existing.typeId.includes('bedwars:upgrade_') || existing.nameTag?.includes('§a'))) {
                    inv.setItem(slot, undefined);
                }
            }
        }
    });
}

/**
 * @param {Entity} trader 
 */
export function setTraderItemPlus_team(trader){
    let inv = trader.getComponent("minecraft:inventory").container;
    let traderTags = trader.getTags();
    let playerTag = traderTags.find(t => world.getPlayers({ name: t }).length > 0);
    let page = 1;
    let Pcategory = 0;
    const pl = world.getPlayers({ name: playerTag })[0];
    if (playerTag) {
        if (pl && pl.bedwarsInfo) Pcategory = pl.bedwarsInfo.category[1]
        if (pl && pl.bedwarsInfo) page = pl.bedwarsInfo.page[1]
    }
        teamUpgradeShopitems.forEach((category,index)=>{
            // ensure category icon in slots 0..8
            let iconSlot = Math.ceil((9-teamUpgradeShopitems.length)/2)-1+index
            const icon = itemInfo(category[0], { amount: page, lore: index === Pcategory ? [`§r页码: ${page}/${Math.ceil((category.length-1)/18)}`,"点击以切换页码"] : [] });
            const existingIcon = inv.getItem(Math.ceil((iconSlot)));
            if (!existingIcon || existingIcon.typeId !== category[0] || existingIcon.amount !== icon.amount ) inv.setItem(iconSlot, icon);

            if (index !== Pcategory) return; // only populate items for active category

            // build list of items to display (excluding the category icon at index 0)
            const allItems = category.slice(1);
            let itemsToShow = [];

            // 对于团队升级分类（index === 0）我们按队伍当前升级等级合并显示下一等级或最高等级
            if (index === 0 && pl && pl.bedwarsInfo) {
                const team = pl.bedwarsInfo.getTeam();
                const teamUpgrade = team.teamUpgrade || {};

                // 计算每个 base 升级的最大 tier（例如 reinforced_armor 的最大 tier）
                const maxTierByBase = {};
                allItems.forEach(si => {
                    const m = String(si.id).match(/(.+)_tier_(\d+)$/);
                    if (m) {
                        const base = m[1]; const t = Number(m[2]);
                        if (!maxTierByBase[base] || t > maxTierByBase[base]) maxTierByBase[base] = t;
                    }
                });

                // 筛选：优先显示下一等级；若玩家已达最大等级，则显示最高级
                allItems.forEach(si => {
                    try {
                        const m = String(si.id).match(/(.+)_tier_(\d+)$/);
                        if (m) {
                            const base = m[1]; const tier = Number(m[2]);
                            // 将 base 转为 teamUpgrade 对象中的属性名（snake_case -> camelCase）
                            const prop = base.split('_').map((p, i) => i === 0 ? p : (p[0].toUpperCase() + p.slice(1))).join('');
                            const playerLevel = Number(teamUpgrade[prop]) || 0;
                            const maxTier = maxTierByBase[base] || 0;
                            if (tier === playerLevel + 1) {
                                itemsToShow.push(si);
                            } else if (playerLevel >= maxTier && tier === maxTier) {
                                // 已达到或超过最大等级，保留最高级显示
                                itemsToShow.push(si);
                            }
                        } else {
                            // 无 tier 的团队升级（例如 heal_pool, dragon_buff）默认显示（如果你想改规则可再调整）
                            itemsToShow.push(si);
                        }
                    } catch (e) { /* ignore malformed items */ }
                });

                // 去重（按 shopitemId）
                const seen = new Set();
                itemsToShow = itemsToShow.filter(si => { const id = si.shopitemId || si.itemId || si.id; if (seen.has(id)) return false; seen.add(id); return true; });
            } else {
                // 其他分类（比如陷阱）保持原有显示
                itemsToShow = allItems.slice();
            }

            const expectedCount = Math.max(0, itemsToShow.length);
            // fill expected item slots starting at slot 9 (paged)
            const startIndex = (page - 1) * 18;
            // 尝试获取当前查看该商人的玩家所在队伍，以便 generateLore 能生成动态价格（用于陷阱）
            const teamForLore = (pl && pl.bedwarsInfo) ? pl.bedwarsInfo.getTeam() : undefined;
            for (let i = 0; i < 18; i++) {
                const globalIndex = startIndex + i;
                const shopItem = itemsToShow[globalIndex];
                const slot = 9 + i;
                if (shopItem) {
                    const amount = shopItem.itemAmount || 1;
                    const lore = typeof shopItem.generateLore === 'function' ? shopItem.generateLore(teamForLore ? { team: teamForLore } : undefined) : (shopItem.description ? ["", shopItem.description] : []);
                    const name = shopItem.itemName;
                    /**@type {ItemStack}*/const existing = inv.getItem(slot);
                    if (!existing || existing.typeId !== shopItem.shopitemId) {
                        inv.setItem(slot, itemInfo(shopItem.shopitemId, { amount: amount, lore: lore, name: name }));
                    }
                }
            }

            /** 获取陷阱的代表物品 @param { "all" | "" | "its_a_trap" | "counter_offensive_trap" | "alarm_trap" | "miner_fatigue_trap" } trapQueueType - 陷阱类型 */
            let trapItem = ( trapQueueType ) => { 
                switch ( trapQueueType ) { 
                    case "all": return [
                        "minecraft:light_gray_stained_glass",
                        "minecraft:tripwire_hook",
                        "minecraft:feather",
                        "minecraft:redstone_torch",
                        "minecraft:iron_pickaxe"
                    ]
                    case "": return "minecraft:light_gray_stained_glass"; 
                    case "its_a_trap": return "minecraft:tripwire_hook"; 
                    case "counter_offensive_trap": return "minecraft:feather"; 
                    case "alarm_trap": return "minecraft:redstone_torch"; 
                    case "miner_fatigue_trap": return "minecraft:iron_pickaxe"; 
                } 
            }
            
            if(Pcategory === 1){
                /** 获取基本信息 */
                let team = pl.bedwarsInfo.getTeam()
                let trap1 = team.teamUpgrade.trap1Type;
                let trap2 = team.teamUpgrade.trap2Type;
                let trap3 = team.teamUpgrade.trap3Type;

                /** 获取陷阱名称 @param { "" | "its_a_trap" | "counter_offensive_trap" | "alarm_trap" | "miner_fatigue_trap" } trapQueueType - 陷阱类型 */
                let trapName = ( trapQueueType ) => { switch ( trapQueueType ) { case "": return "无陷阱！"; case "its_a_trap": return "这是个陷阱！"; case "counter_offensive_trap": return "反击陷阱"; case "alarm_trap": return "报警陷阱"; case "miner_fatigue_trap": return "挖掘疲劳陷阱"; } }

                /** 获取陷阱颜色 @param { "" | "its_a_trap" | "counter_offensive_trap" | "alarm_trap" | "miner_fatigue_trap" } trapQueueType - 陷阱类型 */
                let trapColor = ( trapQueueType ) => { return trapQueueType === "" ? "§r§c" : "§r§a"}

                /** 获取下个陷阱要消耗的钻石数 */
                let nextTrapNeedsDiamond = () => { return team.teamUpgrade.trap1Type === "" ? "§b1 钻石" : ( team.teamUpgrade.trap2Type === "" ? "§b2 钻石" : ( team.teamUpgrade.trap3Type === "" ? "§b4 钻石" : "§c陷阱队列已满！" ) ) }

                inv.setItem( 21, itemInfo(trapItem(trap1), { name: `${trapColor(trap1)}陷阱 #1 ： ${trapName(trap1)}`, lore: [ "§r§7第一个敌人进入你的基地时将触发此陷阱！", "", "§r§7购买的陷阱将在此排队触发。\n陷阱的价格将随着队列中陷阱的数量而增加。", "", `§r§7下个陷阱： ${nextTrapNeedsDiamond()}` ], itemLock: "slot" }) )
                inv.setItem( 22, itemInfo(trapItem(trap2), { name: `${trapColor(trap2)}陷阱 #2 ： ${trapName(trap2)}`, lore: [ "§r§7第二个敌人进入你的基地时将触发此陷阱！", "", "§r§7购买的陷阱将在此排队触发。\n陷阱的价格将随着队列中陷阱的数量而增加。", "", `§r§7下个陷阱： ${nextTrapNeedsDiamond()}` ], itemLock: "slot" }) )
                inv.setItem( 23, itemInfo(trapItem(trap3), { name: `${trapColor(trap3)}陷阱 #3 ： ${trapName(trap3)}`, lore: [ "§r§7第三个敌人进入你的基地时将触发此陷阱！", "", "§r§7购买的陷阱将在此排队触发。\n陷阱的价格将随着队列中陷阱的数量而增加。", "", `§r§7下个陷阱： ${nextTrapNeedsDiamond()}` ], itemLock: "slot" }) )
            }

            // clear leftover slots beyond expectedCount that contain shopitem_ or upgrade_ to avoid stale items
            for (let s = 0; s < 9; s++) {
                if( s <= Math.ceil((9-teamUpgradeShopitems.length)/2)-1+teamUpgradeShopitems.length-1 && s >= Math.ceil((9-teamUpgradeShopitems.length)/2)-1) continue;
                const it = inv.getItem(s);
                if (!it) continue;
                if (it.typeId.includes('bedwars:shopitem_') || it.typeId.includes('bedwars:upgrade_') || it.typeId.includes('bedwars:category_') || trapItem("all").includes(it.typeId)) {
                    inv.setItem(s, undefined);
                }
            }
            for (let s = 9 + expectedCount-(page-1)*18; s < inv.size; s++) {
                if( Pcategory === 1 && s === 21) continue;
                if( Pcategory === 1 && s === 22) continue;
                if( Pcategory === 1 && s === 23) continue;
                const it = inv.getItem(s);
                if (!it) continue;
                if (it.typeId.includes('bedwars:shopitem_') || it.typeId.includes('bedwars:upgrade_') || it.typeId.includes('bedwars:category_') || trapItem("all").includes(it.typeId)) {
                    inv.setItem(s, undefined);
                }
            }
        });
}

/**
 * 清除分割板
 * @param {Player} player 
 */
export function clearDivider( player ){
    player.runCommand(`clear @s bedwars:divider`)
    player.runCommand(`clear @s bedwars:selected_divider`)
    player.runCommand(`clear @s bedwars:prohibited`)
}

export function setTraderTrap( trader ){
    let inv = trader.getComponent("minecraft:inventory").container;
    let traderTags = trader.getTags();
    let playerTag = traderTags.find(t => world.getPlayers({ name: t }).length > 0);
    let page = 1;
    let Pcategory = 0;
    const pl = world.getPlayers({ name: playerTag })[0];
    if (playerTag) {
        if (pl && pl.bedwarsInfo) Pcategory = pl.bedwarsInfo.category[1]
        if (pl && pl.bedwarsInfo) page = pl.bedwarsInfo.page[1]
    }
        let category = teamUpgradeShopitems[1]
            // fill expected item slots starting at slot 9 (paged)
            const startIndex = (page - 1) * 18;
            // 尝试获取当前查看该商人的玩家所在队伍，以便 generateLore 能生成动态价格（用于陷阱）
            const teamForLore = (pl && pl.bedwarsInfo) ? pl.bedwarsInfo.getTeam() : undefined;
            for (let i = 1; i < category.length; i++) {
                const globalIndex = startIndex + i;
                const shopItem = category[globalIndex];
                const slot = 8 + i;
                if (shopItem) {
                    const amount = shopItem.itemAmount || 1;
                    const lore = typeof shopItem.generateLore === 'function' ? shopItem.generateLore(teamForLore ? { team: teamForLore } : undefined) : (shopItem.description ? ["", shopItem.description] : []);
                    const name = shopItem.itemName;
                    inv.setItem(slot, itemInfo(shopItem.shopitemId, { amount: amount, lore: lore, name: name }));
                }
            }
}

/**
 * 
 * @param {Container} fromContainer 
 * @param {Number} fromSlot 
 * @param {Container} toContainer 
 * @param {Number} toSlot 
 */
export function transferItem( fromContainer, fromSlot, toContainer, toSlot ){
    let item = fromContainer.getItem(fromSlot)
    let ret = true

    if(!toSlot) return;
    if(item.lockMode !== ItemLockMode.none) return;

    if(toSlot === -1){
        let rItem = toContainer.addItem(item)
        if(rItem){
            fromContainer.setItem(fromSlot,rItem)
            ret = false
        }else{
            fromContainer.setItem(fromSlot,undefined)
        }
    }else{
        toContainer.setItem(toSlot,item)
        fromContainer.setItem(fromSlot,undefined)
    }
    return ret;
}

/**
 * @param {Player} player 
 */
export function categoryClick(player){
    for(let i = 0; i < categorySign.length; i++){
        if(player.getComponent("minecraft:cursor_inventory").item?.typeId === categorySign[i]){
            player.getComponent("minecraft:cursor_inventory").clear()
            player.playSound("random.click", player.location)
            if(player.bedwarsInfo.category[0] === i){
                if(categories[i].length!==0 && categories[i].length!==1){
                    player.bedwarsInfo.page[0]===Math.ceil((categories[i].length-1)/18) ? player.bedwarsInfo.page[0] = 1 : player.bedwarsInfo.page[0]++
                }
            }else{
                player.bedwarsInfo.category[0] = i
            }
        }
    }
    for(let i = 0; i < teamCategorySign.length; i++){
        if(player.runCommand(`execute if entity @s[hasitem={item=${teamCategorySign[i]}}]`)?.successCount > 0){
            player.runCommand(`clear @s ${teamCategorySign[i]} 0`)
            player.playSound("random.click", player.location)
            if(player.bedwarsInfo.category[1] === i){
                if(teamUpgradeShopitems[i].length!==0 && teamUpgradeShopitems[i].length!==1){
                    player.bedwarsInfo.page[1]===Math.ceil((teamUpgradeShopitems[i].length-1)/18) ? player.bedwarsInfo.page[1] = 1 : player.bedwarsInfo.page[1]++
                }
            }else{
                player.bedwarsInfo.category[1] = i
            }
        }
    }
}

/** 用于按照给定的信息输出特定的 itemStack
 * @param {String} itemId - 物品 ID
 * @param {{
 * amount: Number,
 * enchantments: { id: String, level: Number }[],
 * itemLock: "none" | "inventory" | "slot",
 * lore: String[]
 * name: String
 * clearVelocity: Boolean
 * }} options - 可设置项
 */
export function itemInfo( itemId, options={} ) {

    // 可选项设置
    const defaultOptions = {
        amount: 1,
        enchantments: [],
        itemLock: "none",
        lore: [],
        name: undefined
    }; const allOptions = { ...defaultOptions, ...options };

    // 新建物品
    let item = new ItemStack( itemId, allOptions.amount );

    // 设置附魔
    if ( allOptions.enchantments.length !== 0 ) {
        allOptions.enchantments.forEach( enchantment => {
            // 只有当附魔为大于 0 级时才能施加，否则跳过这个步骤
            if ( enchantment.level > 0 ) {
                item.getComponent( "minecraft:enchantable" ).addEnchantment( { type: new EnchantmentType( enchantment.id ) , level: enchantment.level } )
            }
        } );
    }

    // 设置物品锁定
    item.lockMode = allOptions.itemLock;

    // 设置物品 Lore
    item.setLore( allOptions.lore );

    /** 设置物品的名称 */
    if ( allOptions.name !== undefined ) { item.nameTag = allOptions.name }

    // 返回 itemStack
    return item

}

/** 在特定位置生成物品
 * @param {import("@minecraft/server").Vector3} pos - 坐标
 * @param {String} itemId - 要生成的物品 ID
 * @param {{
 * amount: Number,
 * enchantments: { id: String, level: Number }[],
 * itemLock: "none" | "inventory" | "slot",
 * lore: String[]
 * name: String
 * clearVelocity: Boolean
 * }} options - 可设置项
 */
export function spawnItem( pos, itemId, options = {} ) {

    // 可选项设置
    const defaultOptions = { clearVelocity: true };
    const allOptions = { ...defaultOptions, ...options };

    // 获取 itemStack
    let item = itemInfo( itemId, options );

    // 物品生成
    if( allOptions.clearVelocity === true ) {
        let en = overworld.spawnItem( item, pos )
        en.clearVelocity()
        return en
    } else {
        return overworld.spawnItem( item, pos );
    }
}

/**
 * 判断两个物品是否可以堆叠（即：类型、数量、物品锁定、名称、Lore 和附魔完全相同）
 * @param {ItemStack} item1 堆叠至此处
 * @param {ItemStack} item2 被堆叠的物品
 * @returns {Boolean} 返回两个物品是否可以堆叠
 */
export function stackable( item1, item2 ){
    if( item1.typeId !== item2.typeId ) return false;
    if( item1.amount + item2.amount > item1.maxAmount ) return false;
    if( item1.lockMode !== item2.lockMode ) return false;
    if( item1.nameTag !== item2.nameTag ) return false;
    if( !areArraysEqualOrdered( item1.getLore(), item2.getLore() ) ) return false;

    let ench1 = item1.getComponent("minecraft:enchantable")?.getEnchantments()
    let ench2 = item2.getComponent("minecraft:enchantable")?.getEnchantments()
    if( !areArraysEqualUnordered( ench1, ench2 ) ) return false;
    return true;
}

/** 用于给予玩家物品的函数，一般用于命令无法处理的复杂情况
 * @param {Player} player - 要给予物品的玩家
 * @param {String} itemId - 要给予物品的 ID
 * @param {{
 * amount: Number,
 * enchantments: { id: String, level: Number }[],
 * itemLock: "none" | "inventory" | "slot"
 * name: String
 * lore: String[]
 * }} options - 给予物品的附加选项，包括：数目、附魔、物品锁定(原版API之Container.addItem()的重写)
 */
export function giveItem( player, itemId, options = {} ) {

    // 获取 itemStack
    let item = itemInfo( itemId, options );
    let container = player.getComponent( "minecraft:inventory" ).container;

    // 遍历玩家物品
    let breakable = false;
    let amount = item.amount;
    for ( let i = 0; i < container.size; i++ ) {
        if( breakable ) break;
        let slotItem = player.getComponent( "minecraft:inventory" ).container.getItem( i )
        if( slotItem !== undefined ){
            if( stackable( slotItem, item ) ){
                let canAdd = Math.min( amount, slotItem.maxAmount - slotItem.amount );
                slotItem.amount += canAdd;
                if( amount > canAdd ) {
                    amount -= canAdd;
                } else {
                    amount = 0;
                    breakable = true;
                }
                container.setItem( i, slotItem );
                if ( amount <= 0 ) break;
            }
        }
        if( i === container.size - 1 && amount > 0 ){
            container.addItem( item );
            break;
        }
    }
}

/** 用于设置玩家盔甲的函数，一般用于命令无法处理的复杂情况
 * @param {Player} player - 要给予物品的玩家
 * @param {String} itemId - 要给予物品的 ID
 * @param { "Head" | "Chest" | "Legs" | "Feet" } slot - 设置要重置的槽位
 * @param {{
 * amount: Number,
 * enchantments: { id: String, level: Number }[],
 * itemLock: "none" | "inventory" | "slot"
 * lore: String[]
 * name: String
 * }} options - 给予物品的附加选项，包括：数目、附魔、物品锁定
 */
export function replaceEquipmentItem( player, itemId, slot, options = {} ) {

    // 获取 itemStack
    let item = itemInfo( itemId, options );

    // 设置玩家物品
    player.getComponent( "minecraft:equippable" ).setEquipment( slot, item )
   
}

/** 用于设置玩家盔甲的函数，一般用于命令无法处理的复杂情况
 * @param {Player} player - 要给予物品的玩家
 * @param {String} itemId - 要给予物品的 ID
 * @param {Number} slot - 设置要重置的槽位，可选值 0 ~ 35
 * @param {{
 * amount: Number,
 * enchantments: { id: String, level: Number }[],
 * itemLock: "none" | "inventory" | "slot"
 * lore: String[]
 * name: String
 * }} options - 给予物品的附加选项，包括：数目、附魔、物品锁定
 */
export function replaceInventoryItem( player, itemId, slot, options = {} ) {

    // 获取 itemStack
    let item = itemInfo( itemId, options )

    // 给予玩家物品
    player.getComponent( "minecraft:inventory" ).container.setItem( slot, item )

}

/** 获取玩家拥有的物品数目
 * @param {Entity} entity 
 * @param {String} itemId 
 */
export function entityHasItemAmount( entity, itemId ) {

    // 获取待测实体的基础信息（包括：物品栏中为 itemId 的物品 inventoryItems、物品栏大小 inventorysize ）
    let inventory = entity.getComponent( "minecraft:inventory" ).container;
    let inventorysize = inventory.size;
    let inventoryItems= [];
    for ( let i = 0; i < inventorysize; i++ ){ inventoryItems.push( inventory.getItem( i ) ); }
    inventoryItems = inventoryItems.filter( item => { return item !== undefined } ).filter( item => { return item.typeId === itemId } );

    // 计算玩家所拥有的物品数目
    let itemAmount = 0;
    inventoryItems.forEach( item => { itemAmount += item.amount } )
    return itemAmount;

}

/** 输入资源类型，返回物品 ID
 * @param {resourceType} resourceType - 资源类型
 * @returns 返回物品 ID
 */
export function resourceTypeToResourceId( resourceType ) {
    switch ( resourceType ) {
        case "iron": return "bedwars:iron_ingot";
        case "gold": return "bedwars:gold_ingot";
        case "diamond": return "bedwars:diamond";
        case "emerald": return "bedwars:emerald";
        default: return "";
    }
}

/** 用于获取特定槽位下，特定附魔的等级
 * @param {Player} player - 要检测的玩家
 * @param {EquipmentSlot} slot - 要检测的槽位
 * @param {String} enchantmentId - 要检测的附魔
 * @returns {Number} 当该物品未定义或该物品无特定附魔时，返回 0 ；其余情况，返回附魔等级。
 */
export function getEnchantmentLevel( player, slot, enchantmentId ) {

    // 当该物品未定义时，返回 0
    if ( player.getComponent( "minecraft:equippable" ).getEquipment( slot ) === undefined ) {
        return 0;

    // 当该物品对应的附魔未定义时，返回 0
    } else if ( player.getComponent( "minecraft:equippable" ).getEquipment( slot ).getComponent( "minecraft:enchantable" ).getEnchantment( enchantmentId ) === undefined ) {
        return 0;

    // 除此之外的情况（即物品和附魔都有定义），返回对应数值
    } else {
        return player.getComponent( "minecraft:equippable" ).getEquipment( slot ).getComponent( "minecraft:enchantable" ).getEnchantment( enchantmentId ).level
    }
}

/** 使每个玩家都执行一个 callback 函数
 * @param {function(Player): void} callback - 一个接受 Player 类型参数的函数
 */
export function eachPlayer( callback ) {
    system.run(()=>{
        world.getPlayers().forEach( player => { callback( player ) } )
    })
}

/** 使每个拥有有效数据的玩家都执行一个 callback 函数；没有有效数据的玩家将不会执行任何东西。
 * @param {function(Player): void} callback - 一个接受 Player 类型参数的函数
 */
export function eachValidPlayer( callback ) {
    let players = world.getPlayers().filter( player => playerIsValid( player ) )
    if ( players.length !== 0 ) { players.forEach( player => { callback( player ) } ) }
}

/** 使每个队伍都执行一个 callback 函数
 * @param {function(BedwarsTeam): void} callback - 一个接受 BedwarsTeam 类型参数的函数
 */
export function eachTeam( callback ) {
    map().teamList.forEach( team => { callback( team ) } )
}

/** 清除特定类型的物品
 * @param {String} itemId - 待清除的物品 ID
 */
export function removeItem( itemId ) {
    overworld.getEntities( { type: "minecraft:item" } ).forEach( item => {
        if ( item.getComponent( "minecraft:item" ).itemStack.typeId === itemId ) { item.remove( ) }
    } )
}

/** 检测某实体是否拥有ID中含有给定字符串的物品
 * @param {Entity} entity 
 * @param {String} stringOfItemId 
 */
export function hasItemTypeTest( entity, stringOfItemId ) {
    /** @type {Container} */ let entityItems = entity.getComponent("minecraft:inventory").container
    let eligibleItems = []; let item;
    for ( let i = 0 ; i < entityItems.size; i++ ) {
        item = entityItems.getItem( i );
        if ( item !== undefined && item.typeId.includes( stringOfItemId ) ) {
            eligibleItems.push( item );
        }
    }
    return eligibleItems;
}

export function fillPlus( pos1, pos2, blockType, dimension = overworld ){
    // 仅对角线：在 x,z 平面按步长插值画线，y 范围内全部填充
    const x1 = Math.floor(pos1.x), x2 = Math.floor(pos2.x);
    const z1 = Math.floor(pos1.z), z2 = Math.floor(pos2.z);
    const y1 = Math.floor(pos1.y), y2 = Math.floor(pos2.y);

    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const dx = x2 - x1, dz = z2 - z1;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));

    if (steps === 0) {
        // 同一点：直接在该 (x1,z1) 上填充 y
        for (let y = minY; y <= maxY; y++) {
            if (dimension.getBlock({ x: x1, y: y, z: z1 }).typeId === 'minecraft:air') {
                dimension.setBlockType({ x: x1, y: y, z: z1 }, blockType);
            }
        }
        return;
    }

    for (let i = 0; i <= steps; i++){
        const x = x1 + Math.round(i * dx / steps);
        const z = z1 + Math.round(i * dz / steps);
        for (let y = minY; y <= maxY; y++){
            if (dimension.getBlock({ x: x, y: y, z: z }).typeId === 'minecraft:air') {
                dimension.setBlockType({ x: x, y: y, z: z }, blockType);
            }
        }
    }
}

/** 从队伍的名称获取到队伍的数字ID
 * @param {"red"|"blue"|"yellow"|"green"|"white"|"cyan"|"pink"|"gray"|"orange"|"brown"|"purple"|undefined} teamName - 待转换的队伍名称
 */
export function teamNameToTeamNumber( teamName ) {
    switch ( teamName ) {
        case "red": return 1; case "blue": return 2; case "yellow": return 3; case "green": return 4;
        case "white": return 5; case "cyan": return 6; case "pink": return 7; case "gray": return 8;
        case "orange": return 9; case "brown": return 10; case "purple": return 11; default: return 12;
    }
}

/** 从队伍的数字ID获取到队伍的名称
 * @param {1|2|3|4|5|6|7|8|9|10|11|12} teamNumber - 待转换的队伍数字ID
 */
export function teamNumberToTeamName( teamNumber ) {
    switch ( teamNumber ) {
        case 1: return "red"; case 2: return "blue"; case 3: return "yellow"; case 4: return "green";
        case 5: return "white"; case 6: return "cyan"; case 7: return "pink"; case 8: return "gray";
        case 9: return "orange"; case 10: return "brown"; case 11: return "purple"; default: return undefined;
    }
}

/** 当在等待期间时，初始化玩家
 * @param {Player} player 
 */
export function initPlayer( player ) {
    player.resetLevel()
    player.triggerEvent("health_reset")
    player.runCommand( `clear @s` );
    player.runCommand( `function lib/modify_data/reset_ender_chest` )
    player.runCommand( `effect @s clear` )
    player.addEffect( "instant_health", 1, { amplifier: 49 } )
    delete player.bedwarsInfo;
    player.nameTag = player.name
}

/** 返回将输入坐标中心化（x + 0.5，z + 0.5）的坐标
 * @param {import("@minecraft/server").Vector3} pos 待中心化的坐标
 */
export function centerPosition( pos ) {
    return { ...pos, x: pos.x + 0.5, z: pos.z + 0.5 }
}

/**
 * 检测此坐标是否能合法放置
 * @param {import("@minecraft/server").Vector3} pos 待检测的坐标
 * @param {string} blockType 方块类型
 * @param {Dimension} dimension 待检测的维度，默认为 overworld
 * @returns {Boolean} 返回此坐标是否能合法放置
 */
export function canPlace( pos, blockType = "", dimension = overworld ) {
    if( pos.y > map().heightLimit.max-2 || pos.y < map().heightLimit.min ) return false;
    let result = true;
    map().teamList.forEach( team => {
        let point = team.spawnpoint
        if( blockType === "bedwars:protection_wall" ) {
            if( Math.abs( pos.x - point.x ) <= 5 && Math.abs( pos.z - point.z ) <= 5 && Math.abs( pos.y - point.y ) <= 5 ) result = false;
        }else if( Math.abs( pos.x - point.x ) <= 3 && Math.abs( pos.z - point.z ) <= 3 && Math.abs( pos.y - point.y ) <= 3 ){ 
            result = false;
        }
    })
    return result;
}

/**
 * 给玩家展示UI
 * @param {Player} player 
 * @param {String} type 
 */
export function showPlayerUI( player, type ){
    switch(type){
        case "specialEffect":
            const Thingslist = {
                finalKillEffect : {
                    lightning : { id: "lightning", name: "§r§5§l雷鸣之时", displayName: "§r§5§l雷鸣之时§r §d特效§r", description: "§r--雷鸣之时，万物皆俯瞰苍穹! §5[史诗]", price: 80000, moneyType: "coin" },
                    cookie_bomb : { id: "cookie_bomb", name: "§r§p§l曲奇炸弹", displayName: "§r§p§l曲奇炸弹§r §d特效§r", description: "§r--唔...要撑死拉! §p[传说]", price: 1000, moneyType: "diamond" },
                    absolute_crush : { id: "absolute_crush", name: "§r§p§l绝对碾压", displayName: "§r§p§l绝对碾压§r §d特效§r", description: "§r--在你面前的，只有绝对的力量! §p[传说]", price: 2000, moneyType: "diamond" },
                }
            }
            const buttons = {
                shop : ( player ) => {
                    let shop = new ActionFormData()
                    shop.title( "§e特效商城 §r|§r §c新年焕新颜" )
                    shop.button( "§r§b最终击杀 §d特效§r" )
                    shop.show( player ).then( response => {
                        switch ( response.selection ) {
                            case 0: buttons.finalKillEffect( player ); break;
                        }
                    })
                },
                equipment : ( player ) => {
                    let equipment = new ActionFormData()
                    let specialEffects = decodeFromJsonString(player.getDynamicProperty("special_effect.final_kill"), { got: [], using: undefined } )
                    equipment.title( "§a特效装备 §r|§r 实力的证明!" )
                    if( specialEffects.got.length === 0 ){
                        equipment.label( "§r§7你还没有购买任何最终击杀特效，快去商店看看吧！" )
                    }else{
                        equipment.label( "§r§e------------在此装备特效-----------" )
                        equipment.divider()
                    }
                    specialEffects.got.forEach( effectId => {
                        let effectInfo = Thingslist.finalKillEffect[ effectId ]
                        equipment.button( effectInfo.name + ( specialEffects.using === effectId ? " §a[使用中]" : "" ) )
                    })
                    equipment.button( "§l无特效§r | §c关闭特效显示")
                    equipment.show( player ).then( response => {
                        if( response.selection < specialEffects.got.length ){
                            let effectId = specialEffects.got[ response.selection ]
                            specialEffects.using = effectId
                            player.setDynamicProperty( "special_effect.final_kill", encodeToJsonString( specialEffects ) )
                            player.sendMessage( `§a成功装备 ${Thingslist.finalKillEffect[effectId].name}！` ); 
                        }else if( response.selection == specialEffects.got.length ){
                            specialEffects.using = undefined
                            player.setDynamicProperty( "special_effect.final_kill", encodeToJsonString( specialEffects ) )
                            player.sendMessage( "§a已取消特效装扮!")
                        }
                    })
                },
                finalKillEffect : ( player ) => {
                    let finalKillEffect = new ActionFormData()
                    let ThingslistKeys = Object.keys( Thingslist.finalKillEffect )
                    finalKillEffect.title( "§r§b最终击杀 §d特效§r" )
                    for( let key in Thingslist.finalKillEffect ){
                        finalKillEffect.button( Thingslist.finalKillEffect[key].displayName )
                    }
                    finalKillEffect.show( player ).then( response => {
                        buttons.willBuy( player, Thingslist.finalKillEffect[ ThingslistKeys[response.selection] ] )
                    })
                },
                willBuy : ( player, thing ) => {
                    let willBuy = new ActionFormData()
                    willBuy.title( `购买菜单` )
                    willBuy.label( `§e你即将购买 ${thing.name} §e，确定吗？`)
                    willBuy.divider()
                    willBuy.label( `${thing.description}`)
                    willBuy.label( `§e价格：§r§b${thing.price} ${thing.moneyType === "coin" ? "§7起床硬币" : thing.moneyType === "diamond" ? "§b钻石" : thing.moneyType === "amethyst" ? "§d紫水晶" : "§e星尘"}` )
                    willBuy.divider()
                    willBuy.button( "§a确认购买 §r|§r §e成交!" )
                    willBuy.button( "§c取消 §r|§r §7再看看" )
                    willBuy.show( player ).then( response => {
                        switch ( response.selection ) {
                            case 0: 
                                let specialEffects = decodeFromJsonString(player.getDynamicProperty("special_effect.final_kill"), { got: [], using: undefined } )
                                if( player.getDynamicProperty(thing.moneyType) >= thing.price ){
                                    if( specialEffects.got.includes( thing.id ) === false ){
                                        take( player, thing.moneyType, thing.price )
                                        specialEffects.got.push( thing.id )
                                        specialEffects.using = thing.id
                                        player.setDynamicProperty( "special_effect.final_kill", encodeToJsonString( specialEffects ) )
                                        player.sendMessage( `§a成功购买 ${thing.name}！` ); 
                                    }else{
                                        player.sendMessage( `§c购买失败！你已经拥有这个特效了！` ); 
                                    }
                                }else{
                                    player.sendMessage( `§c购买失败！你的货币不足！` ); 
                                }
                                break;
                            case 1: 
                                player.sendMessage( `§c购买已取消！` ); 
                                break;
                        }
                    })
                }
            }
            let home = new ActionFormData()
            home.title( "§d特效§a装备§r/§e购买" )
            home.button( "§e特效商城 §r|§r §c新年焕新颜" )
            home.button( "§a特效装备 §r|§r 实力的证明!" )
            home.show( player ).then( response => {
                switch ( response.selection ) {
                    case 0: buttons.shop( player ); break;
                    case 1: buttons.equipment( player ); break;
                }
            } )
    }
}

/**
 * 给玩家展示DDUI
 * @param {Player} player 
 * @param {String} type 
 */
export function showPlayerDDUI( player, type ){
    switch(type){
        case "specialEffect":
            const buttons = {
                shop : ( player ) => {
                    let shop = CustomForm.create( player, "§e特效商城 §ka§r|§ka§r §c新年焕新颜")
                        .closeButton()
                        .button( "§ka§r§b最终击杀 §d特效§ka§r", ( player ) => { })
                }
            }
            let home = CustomForm.create( player, "§d特效§a装备§r/§e购买" )
                .closeButton()
                .button( "§e特效商城 §ka§r|§ka§r §c新年焕新颜", ( player ) => { buttons.shop( player ); home.close() })
                .button( "§a特效装备 §ka§r|§ka§r 实力的证明!", ( player ) => {})
                .show()
    }
}

/**
 * 为玩家展示等级
 * @param {Player} player 
 * @param {Object} options 
 */
export function loadXpofPlayer( player, options = { update : true } ){
    if( map().gameStage !== 0 ) return;
    let originalStar = player.getDynamicProperty( "star" )
    let originalLevel = player.getDynamicProperty( "level" )

    if( options.update ){
        let xp = player.getDynamicProperty( "xp" ) || 0
        let star = Math.floor((Math.sqrt(8 * xp / 100 + 1) - 1) / 2);
        let level = Math.floor(star/10)

        player.resetLevel();
        player.addLevels(star)
        player.addExperience( (star + 1) * 100 > 0 ? Math.floor(player.totalXpNeededForNextLevel * ( ( xp - star*(star+1) * 100 /2 ) / ( (star + 1) * 100 ) )) : 0)

        if( originalStar !== star ){
            if( originalLevel !== level ){
                player.sendMessage( ["--------§e§l升阶§r--------", `\n   您已升至 ${colorForLevels(level)}${level}阶${star}星§r !   `, "\n-------------------"])
            }else{
                player.sendMessage( [ "--------§e§l升星§r--------", `\n   您已升至 ${colorForLevels(level)}${level}阶${star}星§r !   `, "\n-------------------"])
            }
        }

        player.setDynamicProperty( "star", star )
        player.setDynamicProperty( "level", level )
    }
}

// ===== 地图类、队伍类、玩家类、设置 =====


/**
 * 可用设置
 */
export const settings = {
    minWaitingPlayers: 2,
    gameStartWaitingTime: 400,
    resourceMaxSpawnTimes: { iron: 256, gold: 64, diamond: 64, emerald: 32 },
    respawnTime: { normalPlayers: 100, rejoinedPlayers: 200 },
    invalidTeamCouldSpawnResources: true,
    randomMap:{ allow2Teams: true, allow4Teams: true, allow8Teams: true },
    CreativePlayerCanBreakBlocks: false
}

/**
 * 玩家类
 */
export class BedwarsPlayer{

    constructor( name, team ) {
        this.name = name;
        this.team = team;
        this.runtimeId = 0;
        this.isSpectator = false;
        this.isEliminated = false;
        this.equipment = { pickaxe: 0, axe: 0, armor: 1, shears: 0 };
        this.magicMilk = { enabled: false, remainingTime: 0 };
        this.rescue = { time : 0, x : undefined , y : undefined , z : undefined }
        this.scroll = { time : 0, x : undefined, y : undefined, z : undefined } 
        this.deathState = { willDeath:false, isDeath: false, respawnCountdown: 100, deathType: "", isRejoinedPlayer: false, deathCount: 0 };
        this.killCount = { kill: 0, finalKill: 0, bed: 0 };
        this.lastHurt = { attacker: undefined, lastAttackedTick: 0 };
        this.page = [1,1];
        this.category = [0,0];
        this.trader = undefined;
        this.tradeView = {x:0, y:0}
        this.protectionTower = 0;
        this.protectionWall = 0;
        this.canFly = false;
        this.affordDamage = { lightning: true, fireTick: true, explosion: true, void: true, fall: true };
        this.itemUseDuration = { "bedwars:sonic_bomb": 0 };
        this.buyCount = { "totem_of_undying": 3 }
    }

    /**
     * 按队伍设定玩家的昵称颜色
     * @param {String} name - 输入玩家的 name 
     * @returns 按队伍输出玩家的 nameTag
     */
    setNameColor( name ){
        switch ( this.team ) {
            case "red": return `§c${name}`;
            case "blue": return `§9${name}`;
            case "yellow": return `§e${name}`;
            case "green": return `§a${name}`;
            case "white": return `§f${name}`;
            case "cyan": return `§3${name}`;
            case "pink": return `§d${name}`;
            case "gray": return `§7${name}`;
            case "orange": return `§6${name}`;
            case "brown": return `§n${name}`;
            case "purple": return `§5${name}`;
            case undefined: return name;
            default: return name;
        }
    };

    /**
     * 当自家床被破坏后，播放消息
     * @param {Player} player - 要将此类消息播报给的玩家
     * @param {String} bedKiller - 破坏床的玩家的 nameTag
     */
    selfBedDestroyed( player, bedKiller ){
        showTitle( player, "§c床已被破坏！", "死亡后不能重生！" )
        player.playSound( "mob.wither.death" );
        player.sendMessage( [ "\n", { translate: "message.bedDestroyed", with: [ `${bedKiller}` ] }, "\n " ] );
    }

    /**
     * 当别队家床被破坏后，播放消息
     * @param {Player} player - 要将此类消息播报给的玩家
     * @param {String} bedKiller - 破坏床的玩家的 nameTag
     * @param {String} teamId - 被破坏床的队伍的队伍名称
     */
    otherBedDestroyed( player, bedKiller, teamId ){
        let soundPos = player.location; soundPos.y += 12;   // 末影龙的麦很炸（确信）
        player.playSound( "mob.enderdragon.growl", { location: soundPos } );
        player.sendMessage( [ "\n", { translate: "message.otherBedDestroyed", with: { rawtext: [ { translate: `team.${teamId}` }, { text: `${bedKiller}` } ] } }, "\n " ] );
    }

    /**
     * 获取玩家所在的队伍
     */
    getTeam( ) {
        return map().teamList.filter( team => { return team.id === this.team } )[0]
    }

    /**
     * 获取玩家信息
     */
    getThisPlayer() {
        return world.getPlayers().filter( player => { return player.name === this.name } )[0]
    }

    /**
     * 在物品栏中显示陷阱状态
     */
    showTrapsInInventory() {

        /** 获取基本信息 */
        let team = this.getTeam()
        let trap1 = team.teamUpgrade.trap1Type;
        let trap2 = team.teamUpgrade.trap2Type;
        let trap3 = team.teamUpgrade.trap3Type;

        /** 获取陷阱名称 @param { "" | "its_a_trap" | "counter_offensive_trap" | "alarm_trap" | "miner_fatigue_trap" } trapQueueType - 陷阱类型 */
        let trapName = ( trapQueueType ) => { switch ( trapQueueType ) { case "": return "无陷阱！"; case "its_a_trap": return "这是个陷阱！"; case "counter_offensive_trap": return "反击陷阱"; case "alarm_trap": return "报警陷阱"; case "miner_fatigue_trap": return "挖掘疲劳陷阱"; } }

        /** 获取陷阱颜色 @param { "" | "its_a_trap" | "counter_offensive_trap" | "alarm_trap" | "miner_fatigue_trap" } trapQueueType - 陷阱类型 */
        let trapColor = ( trapQueueType ) => { return trapQueueType === "" ? "§r§c" : "§r§a"}

        /** 获取下个陷阱要消耗的钻石数 */
        let nextTrapNeedsDiamond = () => { return team.teamUpgrade.trap1Type === "" ? "§b1 钻石" : ( team.teamUpgrade.trap2Type === "" ? "§b2 钻石" : ( team.teamUpgrade.trap3Type === "" ? "§b4 钻石" : "§c陷阱队列已满！" ) ) }

        /** 获取陷阱的代表物品 @param { "" | "its_a_trap" | "counter_offensive_trap" | "alarm_trap" | "miner_fatigue_trap" } trapQueueType - 陷阱类型 */
        let trapItem = ( trapQueueType ) => { switch ( trapQueueType ) { case "": return "minecraft:light_gray_stained_glass"; case "its_a_trap": return "minecraft:tripwire_hook"; case "counter_offensive_trap": return "minecraft:feather"; case "alarm_trap": return "minecraft:redstone_torch"; case "miner_fatigue_trap": return "minecraft:iron_pickaxe"; } }

        replaceInventoryItem( this.getThisPlayer(), trapItem(trap1), 15, { name: `${trapColor(trap1)}陷阱 #1 ： ${trapName(trap1)}`, lore: [ "§r§7第一个敌人进入你的基地时将触发此陷阱！", "", "§r§7购买的陷阱将在此排队触发。\n陷阱的价格将随着队列中陷阱的数量而增加。", "", `§r§7下个陷阱： ${nextTrapNeedsDiamond()}` ], itemLock: "slot" } )
        replaceInventoryItem( this.getThisPlayer(), trapItem(trap2), 16, { name: `${trapColor(trap2)}陷阱 #2 ： ${trapName(trap2)}`, lore: [ "§r§7第二个敌人进入你的基地时将触发此陷阱！", "", "§r§7购买的陷阱将在此排队触发。\n陷阱的价格将随着队列中陷阱的数量而增加。", "", `§r§7下个陷阱： ${nextTrapNeedsDiamond()}` ], itemLock: "slot" } )
        replaceInventoryItem( this.getThisPlayer(), trapItem(trap3), 17, { name: `${trapColor(trap3)}陷阱 #3 ： ${trapName(trap3)}`, lore: [ "§r§7第三个敌人进入你的基地时将触发此陷阱！", "", "§r§7购买的陷阱将在此排队触发。\n陷阱的价格将随着队列中陷阱的数量而增加。", "", `§r§7下个陷阱： ${nextTrapNeedsDiamond()}` ], itemLock: "slot" } )

    }

    /**
     * 传送玩家到重生点
     */
    teleportPlayerToSpawnpoint() {
        if(this.getTeam().spawnpoint===undefined)return false;
        this.getThisPlayer().teleport( this.getTeam().spawnpoint, { facingLocation: this.getTeam().bedInfo.pos } )
        return true;
    }

    /**
     * 在玩家死亡前执行此内容
     * @param {Entity} attacker 
     */
    beforePlayerDied( attacker ) {
        if(this.deathState.willDeath) return;
        this.deathState.willDeath = true;

        let spwanLocation = { x: this.getThisPlayer().location.x, y: this.getThisPlayer().location.y >= 0 ? this.getThisPlayer().location.y : 0, z: this.getThisPlayer().location.z }

        //随机事件检测
        if( map().gameStage == 1 && map().randomEventInfo.id == "wither_living" && map().randomEventInfo.triggered == true ){
            let witherSkeleton = overworld.spawnEntity( "minecraft:wither_skeleton", spwanLocation )
            witherSkeleton.nameTag = `骨仆 ${this.getThisPlayer().nameTag}`
        }

        //最终击杀特效
        if(!this.getTeam().bedInfo.isExist){
            let FKspecialEffects = decodeFromJsonString(attacker?.getDynamicProperty("special_effect.final_kill"))?.using
            switch(FKspecialEffects){
                case "lightning":
                    /** 生成闪电 */
                    getPlayerNearby( spwanLocation, 5).forEach( nPlayer => {
                        nPlayer.bedwarsInfo.affordDamage.lightning = false;
                        nPlayer.bedwarsInfo.affordDamage.fireTick = false;
                        nPlayer.addEffect( "fire_resistance", 2, { amplifier: 0 } )
                    })
                    overworld.spawnEntity( "minecraft:lightning_bolt", spwanLocation );
                break;
                case "cookie_bomb":
                    /** 生成曲奇 */
                    let cookies = []
                    for(let i = 0; i < 20; i++){
                        let item = spawnItem( spwanLocation, "minecraft:cookie" )
                        item.setDynamicProperty( "canPickup", false )
                        item.applyImpulse( { x: Math.random() * 0.5 - 0.25, y: Math.random() * 0.5 + 0.5, z: Math.random() * 0.5 - 0.25 } )
                        cookies.push(item)
                    }
                    for(let j = 0; j < 10; j++){
                        overworld.spawnParticle( "minecraft:villager_happy", { x: spwanLocation.x + Math.random() - 0.5, y: spwanLocation.y + 1+ Math.random() - 0.5, z: spwanLocation.z + Math.random() - 0.5 } )
                    }
                    overworld.playSound( "firework.large_blast", spwanLocation, { volume: 20 } )
                    attacker?.playSound( "firework.large_blast", { location: spwanLocation, volume: 20 } )
                    system.runTimeout( () => {
                        cookies.forEach( cookie => {
                            if( cookie.isValid ){
                                cookie.remove()
                            }
                        })
                    }, 100 )
                    break;
                case "absolute_crush":
                    /** 生成铁砧 */
                    let anvils = []
                    for( let x = -2; x <= 2; x++ ){
                        for( let z = -2; z <= 2; z++ ){
                            system.runTimeout( ()=> {
                                anvils.push( overworld.spawnEntity( "bedwars:se_anvil", { x: Math.floor(spwanLocation.x + x), y: spwanLocation.y + 3, z: Math.floor(spwanLocation.z + z) } ) );
                            }, (x+3) * (z+3))
                        }
                    }
                    overworld.playSound( "random.anvil_land", spwanLocation, { volume: 50 } )
                    attacker.playSound( "random.anvil_land", { location: spwanLocation, volume: 50 } )
                    system.runTimeout( ()=> {
                        anvils.forEach( anvil => {
                            if( anvil.isValid ){
                                anvil.remove()
                            }
                        })
                    },125)
                    break;
            }
        }
        this.getThisPlayer().teleport(this.getThisPlayer().getSpawnPoint());
        this.getThisPlayer().runCommand("effect @s instant_health 50 1")
        this.getThisPlayer().runCommand("effect @s clear")
    }

    /**
     * 当玩家死亡后，执行此内容
     * @param {Entity} killer - 击杀者的信息
     */
    playerDied( killer = undefined ) {

        if(this.deathState.isDeath) return;

        /** 设置玩家为死亡状态 */
        this.deathState.isDeath = true;
        this.deathState.deathCount++;
        let player = this.getThisPlayer()
        let xp = Math.ceil(player.level/4*3)
        player.addLevels( -xp )
        system.runTimeout(()=>{
            player.playSound( "random.orb", { location: player.location, volume: 5, pitch: 1 } )
            player.playSound( "game.player.hurt", { location: player.location, volume: 3, pitch: 1 } )
        },1)

        system.run( ()=> {
            respawnFunction(player)
        })
        GameSystem.Interval( ()=> {
            return respawnFunction(player)
        },20,{ tag: "Interval:respawnFunction" } )

        /** 给予击杀者奖励和击杀数 <lang> @param {Player} killer */
        let killBonus = ( killer, isFinalKill = false ) => {
            /**let ironIngotAmount = entityHasItemAmount( player, "bedwars:iron_ingot" );
            let goldIngotAmount = entityHasItemAmount( player, "bedwars:gold_ingot" );*/
            let diamondAmount = entityHasItemAmount( player, "bedwars:diamond" );
            /**let emeraldAmount = entityHasItemAmount( player, "bedwars:emerald" );
            if ( ironIngotAmount > 0 ) {
                killer.runCommand( `give @s bedwars:iron_ingot ${ironIngotAmount}` )
                killer.sendMessage( `§f+${ironIngotAmount}块铁锭` )
            }
            if ( goldIngotAmount > 0 ) {
                killer.runCommand( `give @s bedwars:gold_ingot ${goldIngotAmount}` )
                killer.sendMessage( `§6+${goldIngotAmount}块金锭` )
            }*/
            if ( diamondAmount > 0 ) {
                killer.runCommand( `give @s bedwars:diamond ${diamondAmount}` )
                killer.sendMessage( `§b+${diamondAmount}钻石` )
            }
            if( xp > 0 ){
                killer.addLevels( xp )
                killer.sendMessage( `§a+${xp}经验` )
            }
            /**if ( emeraldAmount > 0 ) {
                killer.runCommand( `give @s bedwars:emerald ${emeraldAmount}` )
                killer.sendMessage( `§2+${emeraldAmount}绿宝石` )
            }*/
            killer.playSound( "random.orb", { location: killer.location } )
            if ( playerIsValid( killer ) ) {
                isFinalKill ? killer.bedwarsInfo.killCount.finalKill++ : killer.bedwarsInfo.killCount.kill++
            }
        }

        /** 玩家有床时 */
        if ( this.getTeam().bedInfo.isExist ) {

            /** 设置死亡重生时间 */
            this.deathState.respawnCountdown = this.deathState.isRejoinedPlayer ? settings.respawnTime.rejoinedPlayers : settings.respawnTime.normalPlayers;
            this.deathState.isRejoinedPlayer = false;

            /** 按类型播报死亡消息，分发击杀奖励 */
            if ( this.deathState.deathType === "entityAttack" && killer.typeId === "minecraft:player" ) {
                world.sendMessage( { translate: "message.playerDied.beKilled", with: [ `${player.nameTag}`, `${killer.nameTag}` ] } );
                killBonus( killer );
            } else if ( this.deathState.deathType === "entityExplosion" && this.lastHurt.attacker !== undefined ) {
                world.sendMessage( { translate: "message.playerDied.beKilled", with: [ `${player.nameTag}`, `${this.lastHurt.attacker.nameTag}` ] } );
                killBonus( this.lastHurt.attacker );
            } else if ( this.deathState.deathType === "projectile" && killer.typeId === "minecraft:player" ) {
                world.sendMessage( { translate: "message.playerDied.beShot", with: [ `${player.nameTag}`, `${killer.nameTag}` ] } );    
                killBonus( killer );
            } else if ( this.deathState.deathType === "fall" && this.lastHurt.attacker !== undefined ) {
                world.sendMessage( { translate: "message.playerDied.beKilledFall", with: [ `${player.nameTag}`, `${this.lastHurt.attacker.nameTag}` ] } );    
                killBonus( this.lastHurt.attacker );
            } else if ( this.deathState.deathType === "void" && this.lastHurt.attacker !== undefined ) {
                world.sendMessage( { translate: "message.playerDied.beKilledVoid", with: [ `${player.nameTag}`, `${this.lastHurt.attacker.nameTag}` ] } );    
                killBonus( this.lastHurt.attacker );
            } else if ( this.deathState.deathType === "void" && this.lastHurt.attacker === undefined ) {
                world.sendMessage( { translate: "message.playerDied.fellIntoVoid", with: [ `${player.nameTag}` ] } );    
            } else {
                world.sendMessage( `${player.nameTag}§7被${killer.nameTag}§7击败了。`);
            }

        /** 玩家没有床时 */
        } else {

            /** 设置不能重生，提示玩家已被淘汰 */
            this.deathState.respawnCountdown = undefined;
            this.getThisPlayer().sendMessage( { translate: "message.eliminated" } )
            this.isEliminated = true;

            /** 播报信息，给予击杀者奖励 */
            if ( this.deathState.deathType === "entityAttack" && killer.typeId === "minecraft:player" ) {
                world.sendMessage( { translate: "message.playerDied.finalKill.beKilled", with: [ `${player.nameTag}`, `${killer.nameTag}` ] } );
                killBonus( killer, true );
            } else if ( this.deathState.deathType === "entityExplosion" && this.lastHurt.attacker !== undefined ) {
                world.sendMessage( { translate: "message.playerDied.finalKill.beKilled", with: [ `${player.nameTag}`, `${this.lastHurt.attacker.nameTag}` ] } );
                killBonus( this.lastHurt.attacker, true );
            } else if ( this.deathState.deathType === "projectile" && killer.typeId === "minecraft:player" ) {
                world.sendMessage( { translate: "message.playerDied.finalKill.beShot", with: [ `${player.nameTag}`, `${killer.nameTag}` ] } );    
                killBonus( killer, true );
            } else if ( this.deathState.deathType === "fall" && this.lastHurt.attacker !== undefined ) {
                world.sendMessage( { translate: "message.playerDied.finalKill.beKilledFall", with: [ `${player.nameTag}`, `${this.lastHurt.attacker.nameTag}` ] } );    
                killBonus( this.lastHurt.attacker, true );
            } else if ( this.deathState.deathType === "void" && this.lastHurt.attacker !== undefined ) {
                world.sendMessage( { translate: "message.playerDied.finalKill.beKilledVoid", with: [ `${player.nameTag}`, `${this.lastHurt.attacker.nameTag}` ] } );    
                killBonus( this.lastHurt.attacker, true );
            } else if ( this.deathState.deathType === "void" && this.lastHurt.attacker === undefined ) {
                world.sendMessage( { translate: "message.playerDied.finalKill.fellIntoVoid", with: [ `${player.nameTag}` ] } );    
            } else {
                world.sendMessage( `${player.nameTag}§7被${killer.nameTag}§7击败了。§l§b最终击杀！`);
            }
            
        }

        /** 清除玩家的物品 */
        player.runCommand( `clear @s` )

    }

    /**
     * 当玩家重生后，执行此内容
     */
    playerRespawned() {

        let player = this.getThisPlayer()

        /** 设置玩家的游戏模式 */
        player.getGameMode() !== GameMode.Creative ? player.setGameMode( GameMode.Survival ) : null;

        /** 设置玩家为非死亡状态 */
        this.deathState.willDeath = false;
        this.deathState.isDeath = false; 
        this.deathState.respawnCountdown = 0;

        /** 清除玩家的物品 */
        player.runCommand( "clear @s" )

        /** 将玩家的镐和斧降级 */
        this.equipment.axe > 1 ? this.equipment.axe-- : null;
        this.equipment.pickaxe > 1 ? this.equipment.pickaxe-- : null;

        /** 显示信息 */
        showTitle( player, "§a已重生！", "", { fadeInDuration: 0 } );
        player.sendMessage( { translate: "message.respawned" } );

        /** 将玩家传送到重生点位置 */
        this.teleportPlayerToSpawnpoint()

        /** 清空玩家的受伤信息 */
        this.lastHurt.lastAttackedTick = undefined;
        this.lastHurt.attacker = undefined;
        this.deathState.deathType = ""
        player.addEffect( "instant_health", 1, { amplifier: 49 } )

        /** 给玩家无敌时间 */
        player.triggerEvent( "damage_deals_false" )
        system.runTimeout( ()=> {
            player.triggerEvent( "damage_deals_true" )
        }, 100 )

        /**触发事件 */
        GameSystem.afterGameEvents.afterPlayerRespawned.trigger( {player : player} )
    }

    /**
     * 给玩家提供剑
     */
    swordSupplier() {

        let player = this.getThisPlayer();
        let haveSwordTest = () => {
            let types = [ "wooden", "stone", "iron", "diamond", "netherite" ];
            let haveSword = false;
            for ( let type of types ) {
                if ( player.runCommand( `execute if entity @s[hasitem={item=bedwars:${type}_sword}]` ).successCount === 1 || player.runCommand( `execute if entity @s[hasitem={item=bedwars:seven_deadly_sins}]` ).successCount === 1 ) {
                    haveSword = true;
                }
            }
            return haveSword
        }
        if ( !haveSwordTest() ) {
            if ( this.getTeam().teamUpgrade.sharpenedSwords === 0 ) {
                player.runCommand( `give @s bedwars:wooden_sword 1 0 {"item_lock":{"mode":"lock_in_inventory"}}` );
            } else {
                giveItem( player, "bedwars:wooden_sword", { enchantments: [ { id: "sharpness", level: this.getTeam().teamUpgrade.sharpenedSwords } ], itemLock: "inventory" } );
            }
        }

    }

    /**
     * 给玩家提供斧头
     */
    axeSupplier() {

        let player = this.getThisPlayer();

        /** 判断玩家是否有斧头 */
        let haveAxeTest = () => {
            let types = [ "wooden", "stone", "iron", "diamond" ];
            let haveAxe = false;
            for ( let type of types ) {
                if ( player.runCommand( `execute if entity @s[hasitem={item=bedwars:${type}_axe}]` ).successCount === 1 ) {
                    haveAxe = true;
                }
            }
            return haveAxe
        }
        if ( !haveAxeTest() ) {

            /** 设置斧头的种类 */
            let axeType = () => {
                if ( this.equipment.axe === 1 ) { return "bedwars:wooden_axe" }
                else if ( this.equipment.axe === 2 ) { return "bedwars:stone_axe" }
                else if ( this.equipment.axe === 3 ) { return "bedwars:iron_axe" }
                else { return "bedwars:diamond_axe" }
            }

            /** 设置斧头的附魔 */
            let axeEnchantmentLevel = () => {
                if ( this.equipment.axe === 1 || this.equipment.axe === 2  ) { return 1 }
                else if ( this.equipment.axe === 3 ) { return 2 }
                else { return 3 }
            }
            let axeEnchantment = [ { id: "efficiency", level: axeEnchantmentLevel() } ];
            this.getTeam().teamUpgrade.sharpenedSwords>0 ? axeEnchantment.push( { id: "sharpness", level: this.getTeam().teamUpgrade.sharpenedSwords } ) : null;

            /** 给予斧头 */
            this.equipment.axe >= 1 ? giveItem( player, axeType(), { itemLock: "inventory", enchantments: axeEnchantment } ) : null
        }

    }

    /**
     * 给玩家提供镐子
     */
    pickaxeSupplier() {

        let player = this.getThisPlayer();

        /** 判断玩家是否有镐子 */
        let havePickaxeTest = () => {
            let types = [ "wooden", "iron", "golden", "diamond" ];
            let havePickaxe = false;
            for ( let type of types ) {
                if ( player.runCommand( `execute if entity @s[hasitem={item=bedwars:${type}_pickaxe}]` ).successCount === 1 ) {
                    havePickaxe = true;
                }
            }
            return havePickaxe
        }
        if ( !havePickaxeTest() ) {

            /** 设置镐子的种类 */
            let pickaxeType = () => {
                if ( this.equipment.pickaxe === 1 ) { return "bedwars:wooden_pickaxe" }
                else if ( this.equipment.pickaxe === 2 ) { return "bedwars:iron_pickaxe" }
                else if ( this.equipment.pickaxe === 3 ) { return "bedwars:golden_pickaxe" }
                else { return "bedwars:diamond_pickaxe" }
            }

            /** 设置镐子的附魔 */
            let pickaxeEnchantmentLevel = () => {
                if ( this.equipment.pickaxe === 1 || this.equipment.pickaxe === 2  ) { return 1 }
                else if ( this.equipment.pickaxe === 3 ) { return 2 }
                else { return 3 }
            }
            let pickaxeEnchantment = [ { id: "efficiency", level: pickaxeEnchantmentLevel() } ];

            /** 给予镐子 */
            this.equipment.pickaxe >= 1 ? giveItem( player, pickaxeType(), { itemLock: "inventory", enchantments: pickaxeEnchantment } ) : null
        }

    }

    /**
     * 给玩家提供剪刀
     */
    shearsSupplier() {

        let player = this.getThisPlayer();

        if ( player.runCommand( `execute if entity @s[hasitem={item=bedwars:shears}]` ).successCount === 0 ) {
            /** 给予剪刀 */
            this.equipment.shears >= 1 ? giveItem( player, "bedwars:shears", { itemLock: "inventory" } ) : null
        }

    }

    show2TeamsScoreboard() {

        /** @param {BedwarsTeam} team */
        let teamState = ( team ) => {
            if ( team.bedInfo.isExist ) { return "§a✔" }
            else if ( team.getAliveTeamMember().length > 0 ) { return `§a${team.getAliveTeamMember().length}` }
            else { return "§c✘" }
        }

        /** @param {BedwarsTeam} team */
        let playerInTeam = ( team ) => {
            if ( this.team === team.id ) { return "§7（你）" } else { return "" }
        }

        let infoBoardTitle = "§l§e       起床战争§r       "
        let infoBoardMode = `§82队经验模式 ${map().gameId}§r`
        let infoBoardGameEvent = `${map().getEventName()} - §a${secondToMinute( tickToSecond( map().gameEvent.nextEventCountdown ), "string" )}§r`
        let infoBoardTeam1 = `${map().teamList[0].getTeamName("name")} §f${map().teamList[0].getTeamName("full_name")} ： ${teamState(map().teamList[0])} ${playerInTeam(map().teamList[0])}`
        let infoBoardTeam2 = `${map().teamList[1].getTeamName("name")} §f${map().teamList[1].getTeamName("full_name")} ： ${teamState(map().teamList[1])} ${playerInTeam(map().teamList[1])}`
        let infoBoardKillCount = `§f击杀数 ： §a${this.killCount.kill}`
        let infoBoardFinalKillCount = `§f最终击杀数 ： §a${this.killCount.finalKill}`
        let infoBoardBedBreakCount = `§f破坏床数 ： §a${this.killCount.bed}`
        let infoBoardAuthor = "§ePanda"
        let infoBoardSpectator = `§f您当前为旁观者`

        let player = this.getThisPlayer()
        if ( this.team !== undefined ) {
            player.onScreenDisplay.setActionBar( `${infoBoardTitle}\n${infoBoardMode}\n\n${infoBoardGameEvent}\n\n${infoBoardTeam1}\n${infoBoardTeam2}\n\n${infoBoardKillCount}\n${infoBoardFinalKillCount}\n${infoBoardBedBreakCount}\n\n${infoBoardAuthor}` )
        } else {
            player.onScreenDisplay.setActionBar( `${infoBoardTitle}\n${infoBoardMode}\n\n${infoBoardGameEvent}\n\n${infoBoardTeam1}\n${infoBoardTeam2}\n\n${infoBoardSpectator}\n\n${infoBoardAuthor}` )
        }

    }

    /**
     * 为玩家展示四队记分板
     */
    show4TeamsScoreboard() {

        /** @param {BedwarsTeam} team */
        let teamState = ( team ) => {
            if ( team.bedInfo.isExist ) { return "§a✔" }
            else if ( team.getAliveTeamMember().length > 0 ) { return `§a${team.getAliveTeamMember().length}` }
            else { return "§c✘" }
        }

        /** @param {BedwarsTeam} team */
        let playerInTeam = ( team ) => {
            if ( this.team === team.id ) { return "§7（你）" } else { return "" }
        }

        let infoBoardTitle = "§l§e       起床战争§r       "
        let infoBoardMode = `§84队经验模式 ${map().gameId}§r`
        let infoBoardGameEvent = `${map().getEventName()} - §a${secondToMinute( tickToSecond( map().gameEvent.nextEventCountdown ), "string" )}§r`
        let infoBoardTeam1 = `${map().teamList[0].getTeamName("name")} §f${map().teamList[0].getTeamName("full_name")} ： ${teamState(map().teamList[0])} ${playerInTeam(map().teamList[0])}`
        let infoBoardTeam2 = `${map().teamList[1].getTeamName("name")} §f${map().teamList[1].getTeamName("full_name")} ： ${teamState(map().teamList[1])} ${playerInTeam(map().teamList[1])}`
        let infoBoardTeam3 = `${map().teamList[2].getTeamName("name")} §f${map().teamList[2].getTeamName("full_name")} ： ${teamState(map().teamList[2])} ${playerInTeam(map().teamList[2])}`
        let infoBoardTeam4 = `${map().teamList[3].getTeamName("name")} §f${map().teamList[3].getTeamName("full_name")} ： ${teamState(map().teamList[3])} ${playerInTeam(map().teamList[3])}`
        let infoBoardKillCount = `§f击杀数 ： §a${this.killCount.kill}`
        let infoBoardFinalKillCount = `§f最终击杀数 ： §a${this.killCount.finalKill}`
        let infoBoardBedBreakCount = `§f破坏床数 ： §a${this.killCount.bed}`
        let infoBoardAuthor = "§ePanda"
        let infoBoardSpectator = `§f您当前为旁观者`

        let player = this.getThisPlayer()
        if ( this.team !== undefined ) {
            player.onScreenDisplay.setActionBar( `${infoBoardTitle}\n${infoBoardMode}\n\n${infoBoardGameEvent}\n\n${infoBoardTeam1}\n${infoBoardTeam2}\n${infoBoardTeam3}\n${infoBoardTeam4}\n\n${infoBoardKillCount}\n${infoBoardFinalKillCount}\n${infoBoardBedBreakCount}\n\n${infoBoardAuthor}` )
        } else {
            player.onScreenDisplay.setActionBar( `${infoBoardTitle}\n${infoBoardMode}\n\n${infoBoardGameEvent}\n\n${infoBoardTeam1}\n${infoBoardTeam2}\n${infoBoardTeam3}\n${infoBoardTeam4}\n\n${infoBoardSpectator}\n\n${infoBoardAuthor}` )
        }
    }

    show8TeamsScoreboard() {
        /** @param {BedwarsTeam} team */
        let teamState = ( team ) => {
            if ( team.bedInfo.isExist ) { return "§a✔" }
            else if ( team.getAliveTeamMember().length > 0 ) { return `§a${team.getAliveTeamMember().length}` }
            else { return "§c✘" }
        }
        
        /** @param {BedwarsTeam} team */
        let playerInTeam = ( team ) => {
            if ( this.team === team.id ) { return "§7（你）" } else { return "" }
        }
        
        let infoBoardTitle = "§l§e       起床战争§r       "
        let infoBoardMode = `§88队经验模式 ${map().gameId}§r`
        let infoBoardGameEvent = `${map().getEventName()} - §a${secondToMinute( tickToSecond( map().gameEvent.nextEventCountdown ), "string" )}§r`
        let infoBoardTeam1 = `${map().teamList[0].getTeamName("name")} §f${map().teamList[0].getTeamName("full_name")} ： ${teamState(map().teamList[0])} ${playerInTeam(map().teamList[0])}`
        let infoBoardTeam2 = `${map().teamList[1].getTeamName("name")} §f${map().teamList[1].getTeamName("full_name")} ： ${teamState(map().teamList[1])} ${playerInTeam(map().teamList[1])}`
        let infoBoardTeam3 = `${map().teamList[2].getTeamName("name")} §f${map().teamList[2].getTeamName("full_name")} ： ${teamState(map().teamList[2])} ${playerInTeam(map().teamList[2])}`
        let infoBoardTeam4 = `${map().teamList[3].getTeamName("name")} §f${map().teamList[3].getTeamName("full_name")} ： ${teamState(map().teamList[3])} ${playerInTeam(map().teamList[3])}`
        let infoBoardTeam5 = `${map().teamList[4].getTeamName("name")} §f${map().teamList[4].getTeamName("full_name")} ： ${teamState(map().teamList[4])} ${playerInTeam(map().teamList[4])}`
        let infoBoardTeam6 = `${map().teamList[5].getTeamName("name")} §f${map().teamList[5].getTeamName("full_name")} ： ${teamState(map().teamList[5])} ${playerInTeam(map().teamList[5])}`
        let infoBoardTeam7 = `${map().teamList[6].getTeamName("name")} §f${map().teamList[6].getTeamName("full_name")} ： ${teamState(map().teamList[6])} ${playerInTeam(map().teamList[6])}`
        let infoBoardTeam8 = `${map().teamList[7].getTeamName("name")} §f${map().teamList[7].getTeamName("full_name")} ： ${teamState(map().teamList[7])} ${playerInTeam(map().teamList[7])}`
        let infoBoardAuthor = "§ePanda"
        let infoBoardSpectator = `§f您当前为旁观者`
        
        let player = this.getThisPlayer()
        if ( this.team !== undefined ) {
            player.onScreenDisplay.setActionBar( `${infoBoardTitle}\n${infoBoardMode}\n\n${infoBoardGameEvent}\n\n${infoBoardTeam1}\n${infoBoardTeam2}\n${infoBoardTeam3}\n${infoBoardTeam4}\n${infoBoardTeam5}\n${infoBoardTeam6}\n${infoBoardTeam7}\n${infoBoardTeam8}\n\n${infoBoardAuthor}` )
        } else {
            player.onScreenDisplay.setActionBar( `${infoBoardTitle}\n${infoBoardMode}\n\n${infoBoardGameEvent}\n\n${infoBoardTeam1}\n${infoBoardTeam2}\n${infoBoardTeam3}\n${infoBoardTeam4}\n${infoBoardTeam5}\n${infoBoardTeam6}\n${infoBoardTeam7}\n${infoBoardTeam8}\n\n${infoBoardSpectator}\n\n${infoBoardAuthor}` )
        }
        
    }

    /**
     * 玩家退出时，备份数据
     * @param {Player} player - 正在退出的玩家信息
     */
    dataBackup( player ) {
        let name = player.name;
    
        system.run( () => {
            overworld.runCommand( `scoreboard objectives add "${name}" dummy` )
            overworld.runCommand( `scoreboard players set team "${name}" ${teamNameToTeamNumber( this.team )}` )
            overworld.runCommand( `scoreboard players set axeTier "${name}" ${this.equipment.axe}` )
            overworld.runCommand( `scoreboard players set pickaxeTier "${name}" ${this.equipment.pickaxe}` )
            overworld.runCommand( `scoreboard players set shearsTier "${name}" ${this.equipment.shears}` )
            overworld.runCommand( `scoreboard players set armorTier "${name}" ${this.equipment.armor}` )
            overworld.runCommand( `scoreboard players set killCount "${name}" ${this.killCount.kill}` )
            overworld.runCommand( `scoreboard players set finalKillCount "${name}" ${this.killCount.finalKill}` )
            overworld.runCommand( `scoreboard players set bedDestroyed "${name}" ${this.killCount.bed}` )
            overworld.runCommand( `scoreboard players set runtimeId "${name}" ${this.runtimeId}` )
        } )
    
    }

    /**
     * @param {ScoreboardObjective} data 
     */
    dataReset( data ) {

        let player = this.getThisPlayer()

        /** 将备份记分板中的数据还原到玩家数据中，然后移除备份记分板 */
        this.equipment.axe = data.getScore( "axeTier" );
        this.equipment.pickaxe = data.getScore( "pickaxeTier" );
        this.equipment.shears = data.getScore( "shearsTier" );
        this.equipment.armor = data.getScore( "armorTier" );
        this.killCount.kill = data.getScore( "killCount" );
        this.killCount.finalKill = data.getScore( "finalKillCount" );
        this.killCount.bed = data.getScore( "bedDestroyed" );
        this.runtimeId = data.getScore( "runtimeId" );
        world.scoreboard.removeObjective( player.name )

        /** 杀死该玩家，然后设置更长时间的重生时间 */
        this.deathState.isRejoinedPlayer = true;
        player.kill()

        /** 播报消息 */
        this.getTeam().bedInfo.isExist ? player.sendMessage( { translate: "message.playerRejoin.haveBed" } ) : player.sendMessage( { translate: "message.playerRejoin.haveNoBed" } );

    }

    /** */
    showHealth( ) {
        this.getThisPlayer().runCommand( `scoreboard players set @s health ${Math.floor(this.getThisPlayer().getComponent("health").currentValue)}` )
    }

}

/**
 * 打印对象键值对
 * @param {Object} obj - 输入对象
 */
export function object_print(obj) {
    if (obj == undefined) return world.sendMessage(`<§6Undefined§r>`) // 如果输入的内容是Undefined，则整体输出Undefined
    let str_l_1 = []
    try { str_l_1.push(`<§6Object ${obj.constructor.name}`) }
    catch { str_l_1.push(`<§6Object Module`) } // str_l_1现在输出对象的构造函数名，并会尝试检查错误
    let str_l_2 = []
    for (let key in obj) {  // 对象中的每个元素遍历
        let a = `    §a${key} : ` ; let b = ``
        try {obj[key]} catch {continue} // 忽略obj[key]可能造成的错误
        if (obj[key] instanceof Function) { // 如果得到的obj[key]是一个对象中的方法，则输出为`${key}: <Bound Method>`
            b = `§e<Bound Method>`
            str_l_2.push(a + b)
        }
        else {  // 其他情况（即obj[key]不是一个方法）下
            let obj_name = ""
            try {obj_name = obj[key].constructor.name} catch {obj_name = obj[key]}  // 尝试输出构造函数名，如果输出不了一点则直接输出obj[key]本身
            if (!["String","Number","Boolean"].includes(obj_name) &&  obj_name != undefined && obj_name != null) b = `§b<Object ${obj_name}>`
                    // 字符串、数值、布尔值，undefined和null都是直接输出的
            else b = `§b${obj[key]}`    // 如果满足上面的几种情况，直接输出该键对应的值本身
            str_l_1.push(a + b) // 将上面所输出的值添加，以保证非Function是输出在上面的
        }
        
    }
    str_l_2.push("§r>") // 结尾
    world.sendMessage(str_l_1.join('\n') + "\n" + str_l_2.join('\n'));
}
export function object_print_no_method(obj) {
    if (obj == undefined) return world.sendMessage(`<§6Undefined§r>`) // 如果输入的内容是Undefined，则整体输出Undefined
    let str_l_1 = []
    try { str_l_1.push(`<§6Object ${obj.constructor.name}`) }
    catch { str_l_1.push(`<§6Object Module`) } // str_l_1现在输出对象的构造函数名，并会尝试检查错误
    let str_l_2 = []
    for (let key in obj) {  // 对象中的每个元素遍历
        let a = `    §a${key} : ` ; let b = ``
        try {obj[key]} catch {continue} // 忽略obj[key]可能造成的错误
        if (obj[key] instanceof Function) { // 如果得到的obj[key]是一个对象中的方法，则输出为`${key}: <Bound Method>`
        }
        else {  // 其他情况（即obj[key]不是一个方法）下
            let obj_name = ""
            try {obj_name = obj[key].constructor.name} catch {obj_name = obj[key]}  // 尝试输出构造函数名，如果输出不了一点则直接输出obj[key]本身
            if (!["String","Number","Boolean"].includes(obj_name) &&  obj_name != undefined && obj_name != null) b = `§b<Object ${obj_name}>`
                    // 字符串、数值、布尔值，undefined和null都是直接输出的
            else b = `§b${obj[key]}`    // 如果满足上面的几种情况，直接输出该键对应的值本身
            str_l_1.push(a + b) // 将上面所输出的值添加，以保证非Function是输出在上面的
        }
        
    }
    str_l_2.push("§r>") // 结尾
    world.sendMessage(str_l_1.join('\n') + "\n" + str_l_2.join('\n'));
}
export function object_print_actionbar(obj) {
    if (obj == undefined) return eachPlayer( player => { player.onScreenDisplay.setActionBar(`<§6Undefined§r>`) } )// 如果输入的内容是Undefined，则整体输出Undefined
    let str_l_1 = []
    try { str_l_1.push(`<§6Object ${obj.constructor.name}`) }
    catch { str_l_1.push(`<§6Object Module`) } // str_l_1现在输出对象的构造函数名，并会尝试检查错误
    let str_l_2 = []
    for (let key in obj) {  // 对象中的每个元素遍历
        let a = `    §a${key} : ` ; let b = ``
        try {obj[key]} catch {continue} // 忽略obj[key]可能造成的错误
        if (obj[key] instanceof Function) { // 如果得到的obj[key]是一个对象中的方法，则输出为`${key}: <Bound Method>`
            b = `§e<Bound Method>`
            str_l_2.push(a + b)
        }
        else {  // 其他情况（即obj[key]不是一个方法）下
            let obj_name = ""
            try {obj_name = obj[key].constructor.name} catch {obj_name = obj[key]}  // 尝试输出构造函数名，如果输出不了一点则直接输出obj[key]本身
            if (!["String","Number","Boolean"].includes(obj_name) &&  obj_name != undefined && obj_name != null) b = `§b<Object ${obj_name}>`
                    // 字符串、数值、布尔值，undefined和null都是直接输出的
            else b = `§b${obj[key]}`    // 如果满足上面的几种情况，直接输出该键对应的值本身
            str_l_1.push(a + b) // 将上面所输出的值添加，以保证非Function是输出在上面的
        }
        
    }
    str_l_2.push("§r>") // 结尾
    eachPlayer( player => { player.onScreenDisplay.setActionBar(str_l_1.join('\n') + "\n" + str_l_2.join('\n')) } );
}
export function object_print_actionbar_no_method(obj) {
    if (obj == undefined) return eachPlayer( player => { player.onScreenDisplay.setActionBar(`<§6Undefined§r>`) } )// 如果输入的内容是Undefined，则整体输出Undefined
    let str_l_1 = []
    try { str_l_1.push(`<§6Object ${obj.constructor.name}`) }
    catch { str_l_1.push(`<§6Object Module`) } // str_l_1现在输出对象的构造函数名，并会尝试检查错误
    let str_l_2 = []
    for (let key in obj) {  // 对象中的每个元素遍历
        let a = `    §a${key} : ` ; let b = ``
        try {obj[key]} catch {continue} // 忽略obj[key]可能造成的错误
        if (obj[key] instanceof Function) { // 如果得到的obj[key]是一个对象中的方法，则输出为`${key}: <Bound Method>`
        }
        else {  // 其他情况（即obj[key]不是一个方法）下
            let obj_name = ""
            try {obj_name = obj[key].constructor.name} catch {obj_name = obj[key]}  // 尝试输出构造函数名，如果输出不了一点则直接输出obj[key]本身
            if (!["String","Number","Boolean"].includes(obj_name) &&  obj_name != undefined && obj_name != null) b = `§b<Object ${obj_name}>`
                    // 字符串、数值、布尔值，undefined和null都是直接输出的
            else b = `§b${obj[key]}`    // 如果满足上面的几种情况，直接输出该键对应的值本身
            str_l_1.push(a + b) // 将上面所输出的值添加，以保证非Function是输出在上面的
        }
        
    }
    str_l_2.push("§r>") // 结尾
    eachPlayer( player => { player.onScreenDisplay.setActionBar(str_l_1.join('\n') + "\n" + str_l_2.join('\n')) } );
}
