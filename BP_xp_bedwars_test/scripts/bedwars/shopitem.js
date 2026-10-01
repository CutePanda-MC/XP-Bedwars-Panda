
/** 商店物品 */

import { Entity, Player, world } from "@minecraft/server";
import { overworld } from "./constants";
import { BedwarsPlayer, eachValidPlayer, entityHasItemAmount, giveItem, itemInfo, resourceTypeToResourceId, warnPlayer, setTraderItemPlus_team, setTraderTrap, randomInt } from "./methods"
import { map } from "./maps.js"
import { GameSystem } from "./system.js";
import { BedwarsTeam } from "./team.js";

/** 商店物品类型列表 */
export const shopitemType = [ "sword", "armor", "axe", "pickaxe", "teamUpgrade", "coloredBlock", "knockbackStick", "shears", "bow", "potion", "trap", "other", "tower" ]

/** 可用商人类型列表 */
export const traderType = [ "item", "team_upgrade" ];

/** 【类】商店物品类 */
export class Shopitem{

    /** 【属性】ID */
    id = "";

    /** 【属性】商店物品 ID */
    shopitemId = ""

    /** 【属性】物品类型 @type {"item"|"team_upgrade"} */
    traderType = "item";

    /** 【属性】购买时消耗的资源类型 @type {"xp" | "diamond"} */
    costResourceType = "xp";

    /** 【属性】购买时消耗的资源数量 */
    costResourceAmount = 1;

    /** 【属性】购买时获得的物品数量（也是显示在商店中的物品数目） */
    itemAmount = 1;

    /** 【属性】显示在商店中的物品描述 */
    description = ""; 

    /** [属性] 单八模式的物品描述 */
    loreInSolo = "";

    /** [属性] 显示在商店中的物品名字 */
    itemName = ""

    /** 【属性】物品等级，如果为 0 则为不分等级 @type {0|1|2|3|4} */
    tier = 0;

    /** [属性] 物品最高等级对应的描述 */
    topLore = undefined

    /** [属性] 单八模式的toplore */
    topLoreInSolo = undefined

    /** 【属性】是否为最高等级的物品（这将影响物品在商店中的显示方式） */
    isHighestTier = true;

    /** 【属性】是否在死亡后降低等级（这将影响物品在商店中的显示方式） */
    loseTierUponDeath = false;

    /** 【属性】特殊物品 ID，如果为""则为采用自动生成的 ID */
    itemId = "";

    /** 【属性】商店物品类型 @type {"sword"|"armor"|"axe"|"pickaxe"|"teamUpgrade"|"coloredBlock"|"knockbackStick"|"shears"|"bow"|"potion"|"trap"|"other"|"tower"} */
    itemType = "other";

    /** 【属性】在Solo模式下消耗的资源数量，设置为 0 或负数则为采用默认的数值 */
    costResourceAmountInSolo = 0;

    /** [属性] 限购次数 */
    buyCount = -1;

    /** 【构建器】
     * @param {"item" | "team_upgrade"} traderType - 对应的商人类型
     * @param {String} id - 物品 ID（自动生成商店物品 ID 为 bedwars:shopitem_(id) ）
     * @param {"xp" | "diamond"} costResourceType - 购买时消耗的资源类型
     * @param {Number} costResourceAmount - 购买时消耗的资源数量（常规模式下）
     * @param {Number} itemAmount - 购买时获得的物品数量
     * @param {{
     * description: String, 
     * tier: 0 | 1 | 2 | 3 | 4, 
     * isHighestTier: Boolean, 
     * loseTierUponDeath: Boolean, 
     * itemId: String, 
     * itemName : String,
     * itemType: "sword"|"armor"|"axe"|"pickaxe"|"teamUpgrade"|"coloredBlock"|"knockbackStick"|"shears"|"bow"|"potion"|"trap"|"other"
     * costResourceAmountInSolo: Number
     * topLore: String
     * loreInSolo: String
     * topLoreInSolo: String
     * buyCount: Number
     * }} options - 其他可选内容
     */
    constructor( id, traderType, costResourceType, costResourceAmount, itemAmount, options = {} ) {
        this.traderType = traderType;
        this.id = id;
        this.itemId = `bedwars:${this.id}`;
        if ( options.itemId !== undefined ) { this.itemId = `${options.itemId}` };
        this.costResourceType = costResourceType;
        this.costResourceAmount = costResourceAmount;
        // 兼容旧逻辑：部分代码使用 costXP / costXPInSolo 表示经验消耗
        if ( this.costResourceType === "xp" ) {
            this.costXP = Number(this.costResourceAmount) || 0;
            if ( options.costResourceAmountInSolo !== undefined ) { this.costXPInSolo = Number(options.costResourceAmountInSolo) || 0; }
        } else {
            if ( options.costResourceAmountInSolo !== undefined ) { this.costResourceAmountInSolo = options.costResourceAmountInSolo; }
            // 保留 costXP 字段为 0，避免 generateLore 出现 undefined
            this.costXP = 0; this.costXPInSolo = 0;
        }
        this.itemAmount = itemAmount;
        if ( options.itemName !== undefined ) { this.itemName = options.itemName; }
        if ( options.description !== undefined ) { this.description = options.description; }
        if ( options.loreInSolo !== undefined ) { this.loreInSolo = options.loreInSolo; }
        if ( options.topLore !== undefined ) { this.topLore = options.topLore; }
        if ( options.topLoreInSolo !== undefined ) { this.topLoreInSolo = options.topLoreInSolo; }
        if ( options.tier !== undefined ) { this.tier = options.tier; }
        if ( options.isHighestTier !== undefined ) { this.isHighestTier = options.isHighestTier; }
        if ( options.loseTierUponDeath !== undefined ) { this.loseTierUponDeath = options.loseTierUponDeath; }
        if ( options.itemType !== undefined ) { this.itemType = options.itemType }
        if ( options.buyCount !== undefined ) { this.buyCount = options.buyCount }
        this.shopitemId = ( this.itemType === "teamUpgrade" || this.itemType === "trap" ) ? `bedwars:upgrade_${this.id}` : `bedwars:shopitem_${this.id}`;
        if ( this.id === "protection_tower" ) { this.shopitemId = "minecraft:trapped_chest" }
    };

    getCostXP() {
        if (map()?.isSolo() && this.costXPInSolo > 0) return this.costXPInSolo;
        return this.costXP;
    }

    /** 【方法】获取该物品实际消耗价格。
     * @description 因为在构建时，map还没有创立，所以不能直接将map().isSolo() ? ... : ... 写进构建器，会出现依赖循环
     */
    getCostResourceAmount() {
        /** 如果地图为Solo模式，并且指定了有效的Solo特殊价格，则使用此价格 */
        if ( map().isSolo() && this.costResourceAmountInSolo > 0 ) { return this.costResourceAmountInSolo }
        /** 否则，采用正常价格 */
        else { return this.costResourceAmount }
    }

    /** 【方法】为有色方块设立单独的物品 ID
     * @param {"red"|"blue"|"yellow"|"green"|"pink"|"cyan"|"white"|"gray"|"purple"|"brown"|"orange"} color - 要设定的颜色
     */
    setColoredId( color ) {
        if ( this.itemType === "coloredBlock" ) { this.itemId = `bedwars:${color}_${this.id}` }
    };

    /** 【方法】按照所给定的物品属性自动生成适合的 Lore 显示在商店界面 */
    /**
     * 生成用于展示的 lore
     * @param {{team?: import("./team.js").BedwarsTeam}} [context] - 可选上下文（例如 team），用于动态计算陷阱价格
     */
    generateLore(context = undefined) {
        // 团队升级使用资源（包括陷阱）
        if (this.itemType === "teamUpgrade" || this.itemType === "trap") {
            let resourceColor = "", resourceName = "";
            switch (this.costResourceType) {
                case "iron": resourceColor = "\u00a7f"; resourceName = "铁锭"; break;
                case "gold": resourceColor = "\u00a76"; resourceName = "金锭"; break;
                case "diamond": resourceColor = "\u00a7b"; resourceName = "钻石"; break;
                case "emerald": resourceColor = "\u00a72"; resourceName = "绿宝石"; break;
                default: resourceColor = ""; resourceName = ""; break;
            }

            // 团队升级：若提供了 team 上下文且该物品定义了 topLore，则当队伍已达该升级满级时直接显示 topLore（优先）
            if (this.itemType === 'teamUpgrade' && context && context.team && this.topLore) {
                try {
                    const tu = context.team.teamUpgrade || {};
                    const idStr = String(this.id || "");
                    // 匹配有等级的 id，如 reinforced_armor_tier_4
                    const m = idStr.match(/(.+)_tier_(\d+)$/);
                    const toCamel = (s) => s.split('_').map((p, i) => i === 0 ? p : (p[0].toUpperCase() + p.slice(1))).join('');
                    if (m) {
                        const base = m[1]; const tierNum = Number(m[2]) || 0;
                        const prop = toCamel(base);
                        const currentLevel = Number(tu[prop]) || 0;
                        if (currentLevel >= tierNum) {
                            let lore = map().isSolo()&&this.topLoreInSolo ? this.topLoreInSolo : this.topLore
                            const lines = Array.isArray(lore) ? lore.slice() : String(lore).split('\n');
                            return lines.map(l => `\u00a7r${l}`);
                        }
                    } else {
                        // 非分级的 teamUpgrade（例如 heal_pool -> healPool，布尔类型）
                        const prop = toCamel(idStr);
                        if (tu[prop]) {
                            const lines = Array.isArray(this.topLore) ? this.topLore.slice() : String(this.topLore).split('\n');
                            return lines.map(l => `\u00a7r${l}`);
                        }
                    }
                } catch (e) {
                    // ignore and fall through to normal price display
                }
            }

            // 对于陷阱，价格会随队列长度增长；如果传入了 team 上下文则使用队列状态计算真实价格
            if (this.itemType === 'trap' && context && context.team && context.team.teamUpgrade) {
                try {
                    const tu = context.team.teamUpgrade;
                    const base = Number(this.getCostResourceAmount()) || 0;
                    const costAdder = tu.trap1Type ? (tu.trap2Type ? 3 : 1) : 0;
                    const realCost = base + costAdder;
                    return [`\u00a7r\u00a77${this.description}`, "", `\u00a7r\u00a77花费：${resourceColor}${realCost} ${resourceName}`];
                } catch (e) {
                    // 若出错，退回到基础价格显示
                    return [`\u00a7r\u00a77${this.description}`, "", `\u00a7r\u00a77花费：${resourceColor}${this.getCostResourceAmount()} ${resourceName}`];
                }
            }

            // 非陷阱或无上下文时显示基础价格
            return [`\u00a7r\u00a77${map().isSolo()&&this.loreInSolo ? this.loreInSolo : this.description}`, "", `\u00a7r\u00a77花费：${resourceColor}${this.getCostResourceAmount()} ${resourceName}`];
        }

        // 其他物品使用经验值
        const xpCost = this.getCostXP();
        const xpText = `\u00a7a${xpCost} \u7ecf\u9a8c\u503c`;

        if (this.tier !== 0) {
            let itemTierName = "";
            switch (this.tier) {
                case 1: itemTierName = "\u00a7eI"; break;
                case 2: itemTierName = "\u00a7eII"; break;
                case 3: itemTierName = "\u00a7eIII"; break;
                case 4: itemTierName = "\u00a7eIV"; break;
            }

            if (this.loseTierUponDeath) {
                if (!this.isHighestTier) {
                    return ["", `\u00a7r\u00a77花费：${xpText}`, `\u00a7r\u00a77等级：${itemTierName}`, "", "\u00a7r\u00a77此道具可升级。", "\u00a7r\u00a77死亡将会导致损失一级！", "", "\u00a7r\u00a77每次重生时，至少为最低等级。"];
                } else {
                    return ["", `\u00a7r\u00a77花费：${xpText}`, `\u00a7r\u00a77等级：${itemTierName}`, "", `\u00a7r\u00a77${this.description}`, "\u00a7r\u00a77死亡将会导致损失一级！", "", "\u00a7r\u00a77每次重生时，至少为最低等级。"];
                }
            } else {
                return ["", `\u00a7r\u00a77花费：${xpText}`, `\u00a7r\u00a77等级：${itemTierName}`, "", `\u00a7r\u00a77${this.description}`];
            }
        } else {
            return this.description ? [`\u00a7r\u00a77${this.description}`, "", `\u00a7r\u00a77花费：${xpText}`, "§r§eShift+左键(触屏双击商店物品)\n可§a快捷购买§e(最多一组)!"] : ["", `\u00a7r\u00a77花费：${xpText}`, "§r§eShift+左键(触屏双击商店物品)\n可§a快捷购买§e(最多一组)!"];
        }
    }

    /** 【方法】将物品放入对应商人的物品栏之中（仅用于展示）
     * @param {Number} slotLocation - 欲放置的槽位
     * @param {Entity} trader 
     */
    setTraderItem( slotLocation, trader ) {
        try {
            const inv = trader.getComponent("minecraft:inventory").container;
            const amount = this.itemAmount || 1;
            const lore = typeof this.generateLore === 'function' ? this.generateLore() : (this.description ? ["", this.description] : []);
            inv.setItem(slotLocation + 9, itemInfo(this.shopitemId, { amount: amount, lore: lore }));
        } catch (e) {
            // fail silently to avoid breaking trader population
        }
    }

    /** 【方法】处理玩家购买交互（events 调用）
     * 这是一个安全的占位实现，避免因缺失该方法而抛错。复杂的购买逻辑应在这里实现。
     * @param {Player} player
     */
    playerPurchaseItems( player ) {
        const playerInfo = player.bedwarsInfo;
        if (!playerInfo) {
            warnPlayer(player, { translate: "message.invalidPlayer.purchaseItems" });
            return;
        }
        
        /** @type {BedwarsTeam} */
        const playerTeam = playerInfo.getTeam?.();
        if (!playerTeam) {
            warnPlayer(player, { translate: "message.invalidTeam" });
            return;
        }
        
        const purchaseTest = (callback, options = {}) => {
            const defaults = { 
                itemGot: false, isTeamUpgrade: false, costAdder: 0, 
                currentLevel: 0, name: "", trapQueueFull: false 
            };
            const opt = { ...defaults, ...options };
            
            let realCost = 0;
            let resourceId = "";
            let isResourceCost = false;
            let costLevels = 0;
            
            // 团队升级使用资源
            if (this.itemType === "teamUpgrade" || this.itemType === "trap") {
                realCost = this.getCostResourceAmount() + opt.costAdder;
                resourceId = resourceTypeToResourceId(this.costResourceType);
                isResourceCost = true;
            } else {
                realCost = this.getCostXP() + opt.costAdder;
                costLevels = realCost;
            }
            
            // 条件检查
            if (opt.itemGot || (this.tier !== 0 && this.tier < opt.currentLevel + 1)) {
                warnPlayer(player, { translate: "message.alreadyGotItem" });
                return;
            }
            
            if (this.buyCount !== -1 && playerInfo.buyCount[this.id] <= 0) {
                warnPlayer(player, { translate: "message.buyCountZero" });
                return;
            }
            
            if (this.tier !== 0 && this.tier > opt.currentLevel + 1) {
                switch (this.itemType) {
                    case "axe": 
                        warnPlayer(player, { translate: "message.needItem", with: { rawtext: [{ translate: `message.bedwars:shopitem_${opt.name}_axe` }] } });
                        break;
                    case "pickaxe": 
                        warnPlayer(player, { translate: "message.needItem", with: { rawtext: [{ translate: `message.bedwars:shopitem_${opt.name}_pickaxe` }] } });
                        break;
                    case "teamUpgrade": 
                        warnPlayer(player, { translate: "message.needItem", with: { rawtext: [{ translate: `message.bedwars:upgrade_${opt.name}_tier_${this.tier - 1}` }] } });
                        break;
                }
                return;
            }
            
            if (this.itemType === "trap" && opt.trapQueueFull) {
                warnPlayer(player, { translate: "message.trapQueueFull" });
                return;
            }
            
            if (isResourceCost) {
                if (player.runCommand(`execute if entity @s[hasitem={item=${resourceId},quantity=${realCost}..}]`)?.successCount !== 1) {
                    // debug
                    player.playSound("random.break", {pitch: 1})
                    return;
                }
            } else {
                if (player.level < costLevels) {
                    player.playSound("random.break", {pitch: 1})
                    return;
                }
            }
            
            // 执行购买
            if (isResourceCost) {
                player.runCommand(`clear @s ${resourceId} 0 ${realCost}`);
            } else {
                player.addLevels(-costLevels);
                this.buyCount !== -1 ? playerInfo.buyCount[this.id]-- : null;
            }
            
            if (!opt.isTeamUpgrade) {
                player.playSound("random.orb", { pitch: 1, location: player.location, volume: 7 });
            } else {
                eachValidPlayer(teamPlayer => {
                    if (teamPlayer.bedwarsInfo?.team === player.bedwarsInfo?.team) {
                        teamPlayer.sendMessage({ 
                            translate: "message.purchaseTeamUpgradeSuccessfully", 
                            with: { rawtext: [{ text: player.name }, { translate: `message.${this.shopitemId}` }] } 
                        });
                        teamPlayer.playSound("note.pling", { pitch: 2, location: teamPlayer.location });
                    }
                });
            }
            callback?.();
        };
        const playerTeamUpgrade = playerTeam.teamUpgrade;
        switch (this.itemType) {
            case "sword":
                purchaseTest(() => {
                    player.runCommand("clear @s bedwars:wooden_sword");
                    if (!playerTeamUpgrade?.sharpenedSwords) {
                        giveItem(player, this.itemId, { amount: 1, itemLock: "inventory" });
                    } else {
                        giveItem(player, this.itemId, { 
                            enchantments: [{ id: "sharpness", level: 1 }], 
                            itemLock: "inventory" 
                        });
                    }
                    /**触发事件 */
                    GameSystem.afterGameEvents.afterPlayerUpgradeWeapon.trigger( {team : playerInfo.getTeam() } )
                });
                break;
                
            case "armor":
                const itemTier = this.id === "chain_armor" ? 2 : 
                                this.id === "iron_armor" ? 3 : 
                                this.id === "diamond_armor" ? 4 : 
                                this.id === "netherite_armor" ? 5 : 1;
                purchaseTest(() => {
                    playerInfo.equipment.armor = itemTier; 
                    /**触发事件 */
                    GameSystem.afterGameEvents.afterPlayerUpgradeEquipment.trigger( {player : player} )
                }, { itemGot: playerInfo.equipment?.armor >= itemTier });
                break;
                
            case "axe":
                purchaseTest(() => {
                    playerInfo.equipment.axe++;
                    player.runCommand("clear @s bedwars:wooden_axe");
                    player.runCommand("clear @s bedwars:stone_axe");
                    player.runCommand("clear @s bedwars:iron_axe");
                    /**触发事件 */
                    GameSystem.afterGameEvents.afterPlayerUpgradeWeapon.trigger( {team : playerInfo.getTeam() } )
                    GameSystem.afterGameEvents.afterPlayerUpgradeTool.trigger( {player : player} )
                }, { 
                    currentLevel: playerInfo.equipment?.axe ?? 0, 
                    name: this.tier === 2 ? "wooden" : 
                         (this.tier === 3 ? "stone" : 
                         (this.tier === 4 ? "iron" : "wooden")) 
                });
            break;
                
            case "pickaxe":
                purchaseTest(() => {
                    playerInfo.equipment.pickaxe++;
                    player.runCommand("clear @s bedwars:wooden_pickaxe");
                    player.runCommand("clear @s bedwars:iron_pickaxe");
                    player.runCommand("clear @s bedwars:golden_pickaxe");
                }, { 
                    currentLevel: playerInfo.equipment?.pickaxe ?? 0, 
                    name: this.tier === 2 ? "wooden" : 
                         (this.tier === 3 ? "iron" : 
                         (this.tier === 4 ? "golden" : "wooden")) 
                });
                GameSystem.afterGameEvents.afterPlayerUpgradeTool.trigger( {player : player} )
                break;
                
            case "coloredBlock":
                purchaseTest(() => {
                    this.setColoredId(playerInfo.team);
                    giveItem(player, this.itemId, { amount: this.itemAmount, itemLock: "inventory" });
                });
                break;
                
            case "knockbackStick":
                purchaseTest(() => {
                    giveItem(player, "bedwars:knockback_stick", { 
                        enchantments: [{ id: "knockback", level: 1 }] 
                    });
                });
                break;

            case "flameStick":
                purchaseTest(() => {
                    giveItem(player, "bedwars:flame_stick", { 
                        enchantments: [{ id: "fire_aspect", level: 1 }]
                    })
                })
                break;
                
            case "shears":
                purchaseTest(() => {
                    playerInfo.equipment.shears = 1;
                }, { itemGot: playerInfo.equipment?.shears > 0 });
                GameSystem.afterGameEvents.afterPlayerUpgradeTool.trigger( {player : player} )
                break;
                
            case "bow":
                purchaseTest(() => {
                    let enchantments = [];
                    if (this.id === "bow_power"){ 
                        enchantments = [{ id: "power", level: 1 }];
                    }
                    if (this.id === "bow_power_punch") {
                        enchantments = [{ id: "power", level: 1 }, { id: "punch", level: 1 }];
                    }
                    if (this.id === "bow_power_punch_fire") {
                        enchantments = [{ id: "power", level: 1 }, { id: "punch", level: 1 }, { id: "flame", level: 1 }];
                    }
                    giveItem(player, this.itemId, { enchantments: enchantments });
                });
                break;
                
            case "potion":
                purchaseTest(() => {
                    /**switch (this.id) {
                        case "potion_jump_boost": 
                            giveItem(player, this.itemId, { lore: ["", "§r§9跳跃提升 V (0:45)"] }); 
                            break;
                        case "potion_speed": 
                            giveItem(player, this.itemId, { lore: ["", "§r§9迅捷 II (0:45)"] }); 
                            break;
                        case "potion_invisibility": 
                            giveItem(player, this.itemId, { lore: ["", "§r§9隐身 (0:30)"] }); 
                            break;
                    }*/
                    giveItem(player, this.itemId===undefined?String("bedwars:"+this.id):this.itemId, { lore: this.description!==undefined?["§r"+this.description]:undefined})
                });
                break;

            case "tower":
                purchaseTest(() => {
                    player.getComponent("minecraft:inventory").container.addItem(itemInfo(this.itemId, { amount: this.itemAmount, itemLock: "inventory", name: "§r防御塔", lore:[this.description]}))
                })
                break;
            case "fishingRod":
                purchaseTest(() => {
                    giveItem(player, "minecraft:fishing_rod", { itemLock: "inventory" });
                });
                break;

            case "other":
                purchaseTest(() => {
                    giveItem(player, this.itemId, { amount: this.itemAmount, itemLock: "inventory" });
                });
                break;
                
            case "teamUpgrade":
                if (!playerTeamUpgrade) return;
                
                switch (this.id) {
                    case "sharpened_swords_tier_1":
                        purchaseTest(() => {
                            // 直接设置购买的等级
                            playerTeamUpgrade.sharpenedSwords = this.tier;
                            
                            // 更新所有玩家的装备
                            eachValidPlayer(teamPlayer => {
                                if (teamPlayer.bedwarsInfo?.team === player.bedwarsInfo?.team) {
                                    teamPlayer.bedwarsInfo.equipment.axe = 0;
                                    teamPlayer.bedwarsInfo.equipment.pickaxe = 0;
                                }
                            });
                            /**触发事件 */
                            GameSystem.afterGameEvents.afterPlayerUpgradeWeapon.trigger( {team : playerInfo.getTeam() } )
                        }, { 
                            // 检查是否已经拥有相同或更高等级
                            itemGot: playerTeamUpgrade.sharpenedSwords >= this.tier,
                            isTeamUpgrade: true,
                            currentLevel: playerTeamUpgrade.sharpenedSwords || 0,
                            name: "sharpened_sword"
                        });
                    break;
                        
                    case "reinforced_armor_tier_1":
                    case "reinforced_armor_tier_2":
                    case "reinforced_armor_tier_3":
                    case "reinforced_armor_tier_4":
                        purchaseTest(() => {
                            playerTeamUpgrade.reinforcedArmor = (playerTeamUpgrade.reinforcedArmor || 0) + 1;
                            /**触发事件 */
                            GameSystem.afterGameEvents.afterPlayerUpgradeReinforced.trigger( {team : playerInfo.getTeam()} )
                        }, { 
                            currentLevel: playerTeamUpgrade.reinforcedArmor || 0, 
                            isTeamUpgrade: true, 
                            name: "reinforced_armor" 
                        });
                        break;
                    case "feather_falling_tier_1":
                    case "feather_falling_tier_2":
                        purchaseTest(() => {
                            playerTeamUpgrade.featherFalling = (playerTeamUpgrade.featherFalling || 0) + 1;
                            /**触发事件 */
                            GameSystem.afterGameEvents.afterPlayerUpgradeReinforced.trigger( {team : playerInfo.getTeam()} )
                        }, { 
                            currentLevel: playerTeamUpgrade.featherFalling || 0, 
                            isTeamUpgrade: true, 
                            name: "feather_falling" 
                        });
                        break;
                        
                    case "maniac_miner_tier_1":
                    case "maniac_miner_tier_2":
                        purchaseTest(() => {
                            playerTeamUpgrade.maniacMiner = (playerTeamUpgrade.maniacMiner || 0) + 1;
                        }, { 
                            currentLevel: playerTeamUpgrade.maniacMiner || 0, 
                            isTeamUpgrade: true, 
                            name: "maniac_miner" 
                        });
                        break;
                        
                    case "forge_tier_1":
                    case "forge_tier_2":
                    case "forge_tier_3":
                    case "forge_tier_4":
                        purchaseTest(() => {
                            playerTeamUpgrade.forge = (playerTeamUpgrade.forge || 0) + 1;
                        }, { 
                            currentLevel: playerTeamUpgrade.forge || 0, 
                            isTeamUpgrade: true, 
                            name: "forge" 
                        });
                        break;
                    
                    case "rotating_plus_tier_1":
                    case "rotating_plus_tier_2":
                        purchaseTest(()=>{
                            playerTeamUpgrade.rotatingPlus++
                        },{
                            currentLevel: playerTeamUpgrade.rotatingPlus || 0,
                            isTeamUpgrade: true,
                            name: "rotating_plus"
                        })
                        break;

                    case "heal_pool":
                        purchaseTest(() => {
                            playerTeamUpgrade.healPool = true;
                        }, { itemGot: playerTeamUpgrade.healPool, isTeamUpgrade: true });
                        break;
                        
                    case "dragon_buff":
                        purchaseTest(() => {
                            playerTeamUpgrade.dragonBuff = true;
                        }, { itemGot: playerTeamUpgrade.dragonBuff, isTeamUpgrade: true });
                        break;
                }
                break;
                
            case "trap":
                if (!playerTeamUpgrade) return;
                
                purchaseTest(() => {
                    if (!playerTeamUpgrade.trap1Type) {
                        playerTeamUpgrade.trap1Type = this.id;
                    } else if (!playerTeamUpgrade.trap2Type) {
                        playerTeamUpgrade.trap2Type = this.id;
                    } else if (!playerTeamUpgrade.trap3Type) {
                        playerTeamUpgrade.trap3Type = this.id;
                    }
                    setTraderTrap(player.bedwarsInfo.trader)
                }, { 
                    isTeamUpgrade: true, 
                    costAdder: playerTeamUpgrade.trap1Type ? 
                             (playerTeamUpgrade.trap2Type ? 
                              (playerTeamUpgrade.trap3Type ? 7 : 3) : 1) : 0,
                    trapQueueFull: !!playerTeamUpgrade.trap3Type 
                });
                break;
        }
    }
    }

/**
 * 最高轮换物品数量
 */
export let maxRotatingItems = 3;

/**
 * 随机生成一组轮换物品
 */
export function randomRotatingItems(){
    const items = [...rotatingPool]
    for(let i = 1; i <= maxRotatingItems; i++){
        let index = randomInt(0, items.length - 1);
        categories[8].push(items[index]);
        items.splice(index, 1);
    }
}

export const categories = [
    [
        "bedwars:category_blocks",
        new Shopitem( "wool", "item", "xp", 4, 16, { itemType: "coloredBlock", description: "经济实惠的搭路方块." } ),
        new Shopitem( "stained_hardened_clay", "item", "xp", 24, 12, { itemType: "coloredBlock", description: "用于保卫床的基础方块." } ),
        new Shopitem( "blast_proof_glass", "item", "xp", 16, 4, { itemType: "coloredBlock", description: "怎么炸?" } ),
        new Shopitem( "end_stone", "item", "xp", 32, 8, { description: "较为坚固的方块!" } ),
        new Shopitem( "planks", "item", "xp", 24, 12, { description: "为床提供保护的不错块选.\n 只带了镐子的话就难受了.", itemId: "bedwars:oak_planks" } ),
        new Shopitem( "ladder", "item", "xp", 12, 8, { description: "可用于救助困在树上的猫猫.", itemId: "minecraft:ladder" } ),
        new Shopitem( "cobweb", "item", "xp", 100, 4, { description: "哟,客官您也上网?", itemId: "minecraft:web"}),
        new Shopitem( "amethyst_block", "item", "xp", 200, 4, { description: "为你奏上美妙的乐章." } ),
        new Shopitem( "obsidian", "item", "xp", 1600, 4, { description: "坚不可摧!" } )
    ],
    [
        "bedwars:category_weapons",
        new Shopitem( "stone_sword", "item", "xp", 10, 1, { description:"基础的武器.", itemType: "sword" } ),
        new Shopitem( "iron_sword", "item", "xp", 70, 1, { description:"前期必备!", itemType: "sword" } ),
        new Shopitem( "diamond_sword", "item", "xp", 300, 1, { description:"只是过渡而已.", itemType: "sword" } ),
        new Shopitem( "netherite_sword", "item", "xp", 600, 1, { description:"斩碎万物!", itemType: "sword"}),
        new Shopitem( "seven_deadly_sins", "item", "xp", 800, 1, { description:"这力量只属于你!", itemType:"sword"}),
        new Shopitem( "knockback_stick", "item", "xp", 75, 1, { description:"把敌人击飞吧!", itemType: "knockbackStick" } ),
        new Shopitem( "fishing_rod", "item", "xp", 50, 1, { description:"愿者上钩.", itemType: "fishingRod" } ),
        new Shopitem( "flame_stick", "item", "xp", 100, 1, { description:"赴刀山火海!", itemType: "flameStick" }),
    ],
    [
        "bedwars:category_armor",
        new Shopitem( "chain_armor", "item", "xp", 24, 1, { description: "起码比没有好.", itemType: "armor" } ),
        new Shopitem( "iron_armor", "item", "xp", 120, 1, { description: "坚固的铁才能保护脆弱的心.", itemType: "armor" } ),
        new Shopitem( "diamond_armor", "item", "xp", 600, 1, { description: "闪耀光芒!", itemType: "armor" } ),
        new Shopitem( "netherite_armor", "item", "xp", 1200, 1, {description: "无懈可击!", itemType: "armor"}),
    ],
    [
        "bedwars:category_tools",
        new Shopitem( "shears", "item", "xp", 20, 1, { description: "破坏羊毛的得力工具。\n 该物品是永久的。", itemType: "shears" } ),
        new Shopitem( "wooden_axe", "item", "xp", 15, 1, { tier: 1, isHighestTier: false, loseTierUponDeath: true, itemType: "axe" } ),
        new Shopitem( "stone_axe", "item", "xp", 30, 1, { tier: 2, isHighestTier: false, loseTierUponDeath: true, itemType: "axe" } ),
        new Shopitem( "iron_axe", "item", "xp", 60, 1, { tier: 3, isHighestTier: false, loseTierUponDeath: true, itemType: "axe" } ),
        new Shopitem( "diamond_axe", "item", "xp", 100, 1, { tier: 4, isHighestTier: true, loseTierUponDeath: true, itemType: "axe" } ),
        new Shopitem( "wooden_pickaxe", "item", "xp", 15, 1, { tier: 1, isHighestTier: false, loseTierUponDeath: true, itemType: "pickaxe" } ),
        new Shopitem( "iron_pickaxe", "item", "xp", 30, 1, { tier: 2, isHighestTier: false, loseTierUponDeath: true, itemType: "pickaxe" } ),
        new Shopitem( "golden_pickaxe", "item", "xp", 60, 1, { tier: 3, isHighestTier: false, loseTierUponDeath: true, itemType: "pickaxe" } ),
        new Shopitem( "diamond_pickaxe", "item", "xp", 100, 1, { tier: 4, isHighestTier: true, loseTierUponDeath: true, itemType: "pickaxe" } )
    ],
    [
        "bedwars:category_bows",
        new Shopitem( "bow", "item", "xp", 120, 1, { itemId: "minecraft:bow", itemType: "bow" } ),
        new Shopitem( "bow_power", "item", "xp", 300, 1, { itemId: "minecraft:bow", itemType: "bow", description:"§r§7 力量 I" } ),
        new Shopitem( "bow_power_punch", "item", "xp", 600, 1, { itemId: "minecraft:bow", itemType: "bow", description:"§r§7 力量 I\n§r§7 冲击 I" } ),
        new Shopitem( "bow_power_punch_fire", "item", "xp", 1200, 1, { itemId: "minecraft:bow", itemType: "bow", description:"§r§7 力量 I\n§r§7 冲击 I\n§r§7 火矢 I" } ),
        new Shopitem( "arrow", "item", "xp", 64, 8, { itemId: "minecraft:arrow" } )
    ],
    [
        "bedwars:category_items",
        new Shopitem( "golden_apple", "item", "xp", 30, 1, { description: "疗伤好物。", itemId: "minecraft:golden_apple" } ),
        new Shopitem( "bed_bug", "item", "xp", 40, 1, { description: "在雪球砸中的地方产生一只持续\n 15 秒的蠹虫，为你吸引火力。" } ),
        new Shopitem( "dream_defender", "item", "xp", 120, 1, { description: "让铁傀儡成为你的守家好帮手。\n 持续 4 分钟。" } ),
        new Shopitem( "fireball", "item", "xp", 50 , 1, { description: "右键发射！击飞在桥上行走的敌人！" } ),
        new Shopitem( "tnt", "item", "xp", 100, 1, { description: "放下后即点燃。要炸毁什么\n 东西，它很在行！" } ),
        new Shopitem( "ender_pearl", "item", "xp", 400, 1, { description: "快速打入敌人内部。", itemId: "minecraft:ender_pearl" } ),
        new Shopitem( "water_bucket", "item", "xp", 30, 1, { description: "使来犯敌人减速的良好选择。\n 也能应对 TNT 的威胁。", itemId: "minecraft:water_bucket" } ),
        new Shopitem( "bridge_egg", "item", "xp", 100, 1, { description: "能够沿着其扔出的轨迹\n 创造一座桥梁。" } ),
        new Shopitem( "magic_milk", "item", "xp", 150, 1, { description: "饮用后能够在 30 秒内\n 防止触发敌人的陷阱。" } ),
        new Shopitem( "sponge", "item", "xp", 100, 4, { description: "吸水好手。", itemId: "minecraft:sponge" } ),
        new Shopitem( "rescue_platform", "item", "xp", 200, 1, { description: "经常被虚空刷人头?别担心! \n 在你脚下生成一个平台。\n 仅1绿宝石!" }),
        new Shopitem( "totem_of_undying", "item", "xp", 1024, 1, { description: "达成成就 §e超越生死!\n 拿在手上生效.\n 每局限购3次!",itemId:"minecraft:totem_of_undying",buyCount:3 }),
        new Shopitem( "wind_charge","item", "xp", 160, 1, { description:"核动力推动\n§e更快!",itemId:"minecraft:wind_charge"}),
        new Shopitem( "tp_scroll_1", "item", "xp", 300, 1, { description:"快速回城!"}),
        new Shopitem( "protection_tower", "item", "xp", 128, 1, { description:"§r§e平地起高楼!", itemId: "minecraft:chest", itemName: "§r§a防御塔", itemType:"tower"}),
        new Shopitem( "protection_wall" ,"item", "xp", 50, 1, { description: "长城永固!", itemId: "bedwars:protection_wall" } )

    ],
    [
        "bedwars:category_potions",
        new Shopitem( "potion_speed", "item", "xp", 150, 1, { description: "§7速度 II (0:45)\n\n§5当使用后:\n§9+40% 速度", itemType: "potion" } ),
        new Shopitem( "potion_jump_boost", "item", "xp", 150, 1, { description: "§7跳跃提升 V (0:45)", itemType: "potion" } ),
        new Shopitem( "potion_invisibility", "item", "xp", 300, 1, { description: "§7完全隐身 (0:30)", itemType: "potion" } ),
        new Shopitem( "potion_fire_resistance", "item", "xp", 200, 1, { description: "§7抗火 (1:00)", itemType: "potion" } ),
        new Shopitem( "potion_strength_1", "item", "xp", 500, 1, { description:"§7力量 (0:45)\n\n§5当使用后:\n§9+1.3 攻击伤害", itemType: "potion", itemId:"bedwars:potion_strength_1"}),
        new Shopitem( "potion_resistance", "item", "xp", 300, 1, { description: "§7抗性 (0:20)", itemType: "potion" } ),
        new Shopitem( "potion_instant_health_1", "item", "xp", 25, 1 ,{ description:"§7瞬间治疗", itemType: "potion" , itemId:"bedwars:potion_instant_health_1"}),
        new Shopitem( "potion_instant_health_2", "item", "xp", 60, 1 ,{ description:"§7瞬间治疗 II", itemType: "potion" , itemId:"bedwars:potion_instant_health_2"}),
    ],
    [
        "bedwars:category_resources",
        new Shopitem( "iron_ingot_use", "item", "xp", 1, 1, { description: "分享给你的队友吧!拾起后§a+1经验" , itemId : "bedwars:iron_ingot"}),
        new Shopitem( "gold_ingot_use", "item", "xp", 10, 1, { description: "分享给你的队友吧!拾起后§a+10经验", itemId: "bedwars:gold_ingot"}),
        new Shopitem( "emerald_use", "item", "xp", 100, 1, { description: "分享给你的队友吧!拾起后§a+100经验", itemId: "bedwars:emerald"})
    ],
    [
        "bedwars:category_rotating"
    ]
]

export const rotatingPool = [
    new Shopitem( "firework", "item", "xp", 100, 1, { description: "飞起来!" }),
    new Shopitem( "suspicious_stew", "item", "xp", 250, 1, { description: "黑暗料理!一吃一个不吱声."}),
    new Shopitem( "parachute", "item", "xp", 150, 1, { description: "落地成盒!...嘿嘿骗你的"}),
    new Shopitem( "trampoline", "item", "xp", 200, 1, { description: "这蹦床有力气!"}),
    new Shopitem( "enchanted_golden_apple", "item", "xp", 1000, 1, { description: "君临天下!", itemId: "minecraft:enchanted_golden_apple"}),
    new Shopitem( "spider_trap", "item", "xp", 360, 1, { description: "哦豁,广域网!"}),
    new Shopitem( "flying_cloud", "item", "xp", 640, 1, { description: "俺老孙来也!"}),
    new Shopitem( "scratch_card", "item", "xp", 300, 1, { description: "天上不会掉馅饼,天上会掉钻石啊!"}),
    new Shopitem( "mini_drill", "item", "xp", 800, 1, { description: "拆床能手!"}),
    new Shopitem( "sonic_bomb", "item", "xp", 800, 1, { description: "那一天,人们想起了被坚守者支配的恐惧..."}),
    new Shopitem( "honey_bottle", "item", "xp", 150, 1, { description: "底里摄斯!" } ),
    //new Shopitem( "wither_rose", "item", "xp", 200, 1, { description: "似乎残存着怨灵的诅咒..."} ), //目前有bug
    new Shopitem( "copper_sword", "item", "xp", 150, 1, { description: "?!破伤风之刃!?", itemType: "sword"}),
    new Shopitem( "ether_pearl", "item", "xp", 600, 1, { description: "感受风的呼吸..."} )
]

export const categorySign = [
    "bedwars:category_blocks",
    "bedwars:category_weapons",
    "bedwars:category_armor",
    "bedwars:category_tools",
    "bedwars:category_bows",
    "bedwars:category_items",
    "bedwars:category_potions",
    "bedwars:category_resources",
    "bedwars:category_rotating"
]

export const teamCategorySign = [
    "bedwars:category_upgrades",
    "bedwars:category_traps"
]
    
/** 团队升级商品列表 */
export const teamUpgradeShopitems = [
    [
        "bedwars:category_upgrades",
        new Shopitem("sharpened_swords_tier_1", "team_upgrade", "diamond", 40, 1, {
            description: "己方所有成员的剑和斧\n 将永久获得锋利附魔！\n§e> 锋利 I, §b40 钻石",
            loreInSolo: "己方所有成员的剑和斧\n 将永久获得锋利附魔！\n§e> 锋利 I, §b24 钻石",
            topLore: "己方所有成员的剑和斧\n 将永久获得锋利附魔！\n§a✔ 锋利 I, §b40 钻石\n§e  已满级",
            topLoreInSolo: "己方所有成员的剑和斧\n 将永久获得锋利附魔！\n§a✔ 锋利 I, §b24 钻石\n§e  已满级",
            tier: 1,
            itemType: "teamUpgrade",
            isHighestTier: true,
            costResourceAmountInSolo: 24
        }),
        new Shopitem("reinforced_armor_tier_1", "team_upgrade", "diamond", 8, 1, {
            description: "己方所有成员的盔甲将获得永久保护附魔！\n§e> 保护 I, §b8 钻石\n§7  保护 II, §b16 钻石\n§7  保护 III, §b32 钻石\n§7  保护 IV, §b48 钻石",
            loreInSolo: "己方所有成员的盔甲将获得永久保护附魔！\n§e> 保护 I, §b5 钻石\n§7  保护 II, §b10 钻石\n§7  保护 III, §b20 钻石\n§7  保护 IV, §b30 钻石",
            itemType: "teamUpgrade",
            tier: 1,
            isHighestTier: false,
            costResourceAmountInSolo: 5
        }),
        new Shopitem("reinforced_armor_tier_2", "team_upgrade", "diamond", 16, 2, {
            description: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b8 钻石\n§e> 保护 II, §b16 钻石\n§7  保护 III, §b32 钻石\n§7  保护 IV, §b48 钻石",
            loreInSolo: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b5 钻石\n§e> 保护 II, §b10 钻石\n§7  保护 III, §b20 钻石\n§7  保护 IV, §b30 钻石",
            itemType: "teamUpgrade",
            tier: 2,
            isHighestTier: false,
            costResourceAmountInSolo: 10
        }),
        new Shopitem("reinforced_armor_tier_3", "team_upgrade", "diamond", 32, 3, {
            description: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b8 钻石\n§a✔ 保护 II, §b16 钻石\n§e> 保护 III, §b32 钻石\n§7  保护 IV, §b48 钻石",
            loreInSolo: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b5 钻石\n§a✔ 保护 II, §b10 钻石\n§e> 保护 III, §b20 钻石\n§7  保护 IV, §b30 钻石",
            itemType: "teamUpgrade",
            tier: 3,
            isHighestTier: false,
            costResourceAmountInSolo: 20
        }),
        new Shopitem( "reinforced_armor_tier_4", "team_upgrade", "diamond", 48, 4, {
            description: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b8 钻石\n§a✔ 保护 II, §b16 钻石\n§a✔ 保护 III, §b32 钻石\n§e> 保护 IV, §b48 钻石", 
            loreInSolo: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b5 钻石\n§a✔ 保护 II, §b10 钻石\n§a✔ 保护 III, §b20 钻石\n§e> 保护 IV, §b30 钻石", 
            topLore: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b8 钻石\n§a✔ 保护 II, §b16 钻石\n§a✔ 保护 III, §b32 钻石\n§a✔ 保护 IV, §b48 钻石\n§e  已满级",
            topLoreInSolo: "己方所有成员的盔甲将获得永久保护附魔！\n§a✔ 保护 I, §b5 钻石\n§a✔ 保护 II, §b10 钻石\n§a✔ 保护 III, §b20 钻石\n§a✔ 保护 IV, §b30 钻石\n§e  已满级",
            itemType: "teamUpgrade", 
            tier: 4, 
            isHighestTier: true, 
            costResourceAmountInSolo: 30 
        } ),
        new Shopitem( "feather_falling_tier_1", "team_upgrade", "diamond", 10, 1, {
            description: "己方所有成员的靴子将获得永久的摔落缓冲!\n§e> 摔落缓冲 I, §b10 钻石\n§7  摔落缓冲 II, §b20 钻石",
            loreInSolo: "己方所有成员的靴子将获得永久的摔落缓冲!\n§e> 摔落缓冲 I, §b7 钻石\n§7  摔落缓冲 II, §b15 钻石",
            itemType: "teamUpgrade",
            tier: 1,
            isHighestTier: false,
            costResourceAmountInSolo: 7
        }),
        new Shopitem( "feather_falling_tier_2", "team_upgrade", "diamond", 20, 2, {
            description: "己方所有成员的靴子将获得永久的摔落缓冲!\n§a✔ 摔落缓冲 I, §b10 钻石\n§e>  摔落缓冲 II, §b20 钻石",
            loreInSolo: "己方所有成员的靴子将获得永久的摔落缓冲!\n§a✔ 摔落缓冲 I, §b7 钻石\n§e>  摔落缓冲 II, §b15 钻石",
            topLore: "己方所有成员的靴子将获得永久的摔落缓冲!\n§a✔ 摔落缓冲 I, §b10 钻石\n§a✔  摔落缓冲 II, §b20 钻石\n§e  已满级",
            topLoreInSolo: "己方所有成员的靴子将获得永久的摔落缓冲!\n§a✔ 摔落缓冲 I, §b7 钻石\n§a✔  摔落缓冲 II, §b15 钻石\n§e  已满级",
            itemType: "teamUpgrade",
            tier: 2,
            isHighestTier: true,
            costResourceAmountInSolo: 15
        }),
        new Shopitem("maniac_miner_tier_1", "team_upgrade", "diamond", 4, 1, {
            description: "己方所有成员获得永久急迫效果。\n§e> 急迫 I, §b4 钻石\n§7  急迫 II, §b6 钻石",
            loreInSolo: "己方所有成员获得永久急迫效果。\n§e> 急迫 I, §b2 钻石\n§7  急迫 II, §b4 钻石",
            itemType: "teamUpgrade",
            tier: 1,
            isHighestTier: false,
            costResourceAmountInSolo: 2
        }),
        new Shopitem("maniac_miner_tier_2", "team_upgrade", "diamond", 6, 2, {
            description: "己方所有成员获得永久急迫效果。\n§a✔ 急迫 I, §b4 钻石\n§e> 急迫 II, §b6 钻石",
            loreInSolo: "己方所有成员获得永久急迫效果。\n§a✔ 急迫 I, §b2 钻石\n§e> 急迫 II, §b4 钻石",
            topLore: "己方所有成员获得永久急迫效果。\n§a✔ 急迫 I, §b4 钻石\n§a✔ 急迫 II, §b6 钻石\n§e  已满级",
            topLoreInSolo: "己方所有成员获得永久急迫效果。\n§a✔ 急迫 I, §b2 钻石\n§a✔ 急迫 II, §b4 钻石\n§e  已满级",
            itemType: "teamUpgrade",
            tier: 2,
            isHighestTier: true,
            costResourceAmountInSolo: 4
        }),
        new Shopitem("forge_tier_1", "team_upgrade", "diamond", 5, 1, {
            description: "升级你岛屿资源池的生成速度和最大容量。\n§e> I阶: +50% 资源, §b5 钻石\n§7 II阶: +100% 资源, §b10 钻石\n§7 III阶: 生成绿宝石, §b20 钻石\n§7 IV阶: +200% 资源, §b30 钻石",
            loreInSolo: "升级你岛屿资源池的生成速度和最大容量。\n§e> I阶: +50% 资源, §b4 钻石\n§7 II阶: +100% 资源, §b8 钻石\n§7 III阶: 生成绿宝石, §b16 钻石\n§7 IV阶: +200% 资源, §b24 钻石",
            itemType: "teamUpgrade",
            tier: 1,
            isHighestTier: false,
            costResourceAmountInSolo: 4
        }),
        new Shopitem("forge_tier_2", "team_upgrade", "diamond", 10, 2, {
            description: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b5 钻石\n§e> II阶: +100% 资源, §b10 钻石\n§7 III阶: 生成绿宝石, §b20 钻石\n§7 IV阶: +200% 资源, §b30 钻石",
            loreInSolo: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b4 钻石\n§e> II阶: +100% 资源, §b8 钻石\n§7 III阶: 生成绿宝石, §b16 钻石\n§7 IV阶: +200% 资源, §b24 钻石",
            itemType: "teamUpgrade",
            tier: 2,
            isHighestTier: false,
            costResourceAmountInSolo: 8
        }),
        new Shopitem("forge_tier_3", "team_upgrade", "diamond", 20, 3, {
            description: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b5 钻石\n§a✔ II阶: +100% 资源, §b10 钻石\n§e> III阶: 生成绿宝石, §b20 钻石\n§7 IV阶: +200% 资源, §b30 钻石",
            loreInSolo: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b4 钻石\n§a✔ II阶: +100% 资源, §b8 钻石\n§e> III阶: 生成绿宝石, §b16 钻石\n§7 IV阶: +200% 资源, §b24 钻石",
            itemType: "teamUpgrade",
            tier: 3,
            isHighestTier: false,
            costResourceAmountInSolo: 16
        }),
        new Shopitem("forge_tier_4", "team_upgrade", "diamond", 30, 4, {
            description: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b5 钻石\n§a✔ II阶: +100% 资源, §b10 钻石\n§a✔ III阶: 生成绿宝石, §b20 钻石\n§e> IV阶: +200% 资源, §b30 钻石",
            loreInSolo: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b4 钻石\n§a✔ II阶: +100% 资源, §b8 钻石\n§a✔ III阶: 生成绿宝石, §b16 钻石\n§a✔ IV阶: +200% 资源, §b24 钻石\n§e  已满级",
            topLore: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b5 钻石\n§a✔ II阶: +100% 资源, §b10 钻石\n§a✔ III阶: 生成绿宝石, §b20 钻石\n§a✔ IV阶: +200% 资源, §b30 钻石\n§e  已满级",
            topLoreInSolo: "升级你岛屿资源池的生成速度和最大容量。\n§a✔ I阶: +50% 资源, §b4 钻石\n§a✔ II阶: +100% 资源, §b8 钻石\n§a✔ III阶: 生成绿宝石, §b16 钻石\n§a✔ IV阶: +200% 资源, §b24 钻石\n§e  已满级",
            itemType: "teamUpgrade",
            tier: 4,
            isHighestTier: true,
            costResourceAmountInSolo: 24
        }),
        new Shopitem("rotating_plus_tier_1", "team_upgrade", "diamond", 10, 1, {
            description: "为你的轮换物品解锁更多槽位。\n§e> I阶: 解锁第2个槽位, §b10 钻石\n§7  II阶: 解锁第3个槽位, §b20 钻石",
            loreInSolo: "为你的轮换物品解锁更多槽位。\n§e> I阶: 解锁第2个槽位, §b8 钻石\n§7  II阶: 解锁第3个槽位, §b16 钻石",
            itemType: "teamUpgrade",
            tier: 1,
            isHighestTier: false,
            costResourceAmountInSolo: 8
        }),
        new Shopitem("rotating_plus_tier_2", "team_upgrade", "diamond", 20, 2, {
            description: "为你的轮换物品解锁更多槽位。\n§a✔ I阶: 解锁第2个槽位, §b10 钻石\n§e> II阶: 解锁第3个槽位, §b20 钻石",
            loreInSolo: "为你的轮换物品解锁更多槽位。\n§a✔ I阶: 解锁第2个槽位, §b8 钻石\n§e> II阶: 解锁第3个槽位, §b16 钻石",
            topLore: "为你的轮换物品解锁更多槽位。\n§a✔ I阶: 解锁第2个槽位, §b10 钻石\n§a✔ II阶: 解锁第3个槽位, §b20 钻石\n§e  已满级",
            topLoreInSolo: "为你的轮换物品解锁更多槽位。\n§a✔ I阶: 解锁第2个槽位, §b8 钻石\n§a✔ II阶: 解锁第3个槽位, §b16 钻石\n§e  已满级",
            itemType: "teamUpgrade",
            tier: 2,
            isHighestTier: true,
            costResourceAmountInSolo: 16
        }),
        new Shopitem("heal_pool", "team_upgrade", "diamond", 3, 1, {
            description: "基地附近的队伍成员将拥有生命恢复效果！",
            itemType: "teamUpgrade",
            costResourceAmountInSolo: 1
        }),
        new Shopitem("dragon_buff", "team_upgrade", "diamond", 5, 1, {
            description: "你的队伍在绝杀模式中将会有两条末影龙而不是一条！",
            itemType: "teamUpgrade"
        }),
    ],
    [
        "bedwars:category_traps",
        new Shopitem("its_a_trap", "team_upgrade", "diamond", 1, 1, {
            description: "造成失明和缓慢效果，持续 8 秒。",
            itemType: "trap"
        }),
        new Shopitem("counter_offensive_trap", "team_upgrade", "diamond", 1, 1, {
            description: "赋予基地附近的队友速度 II 与跳跃提升 II\n 效果，持续 15 秒。",
            itemType: "trap"
        }),
        new Shopitem("alarm_trap", "team_upgrade", "diamond", 1, 1, {
            description: "让隐身的敌人立刻显形，并警报入侵者的名字和队伍。",
            itemType: "trap"
        }),
        new Shopitem("miner_fatigue_trap", "team_upgrade", "diamond", 1, 1, {
            description: "造成挖掘疲劳效果，持续 10 秒。",
            itemType: "trap"
        })
    ]
];
    
