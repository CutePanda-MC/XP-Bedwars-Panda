/**
 * 起床战争事件集
 * 带有 <lang> 标签的部分，是可能需要使用 .lang 文件翻译的部分
 */

import {
    world, 
    system, 
    Entity, 
    Container, 
    PlayerBreakBlockBeforeEvent, 
    ItemCompleteUseAfterEvent, 
    ProjectileHitEntityAfterEvent, 
    ProjectileHitBlockAfterEvent, 
    PlayerPlaceBlockAfterEvent, 
    ExplosionBeforeEvent, 
    EntityHurtAfterEvent, 
    EntityDieAfterEvent,
    PlayerLeaveBeforeEvent,
    PlayerSpawnAfterEvent,
    ItemUseAfterEvent,
    ItemUseBeforeEvent,
    ScriptEventCommandMessageAfterEvent,
    Player,
    ExplosionAfterEvent,
    GameMode,
    InputButton,
    EquipmentSlot,
    Dimension,
    PlatformType,
    Block,
    PlayerInteractWithBlockBeforeEvent,
    EffectTypes,
    ItemStartUseAfterEvent,
    ItemStopUseAfterEvent,
    ItemStack,
    PlayerInteractWithBlockAfterEvent,
    PlayerInventoryItemChangeAfterEvent,
    PlayerSwingStartAfterEvent,
    EntitySwingSource,
    EntityHitEntityAfterEvent,
    EntityHurtBeforeEvent,
    PlayerInteractWithEntityBeforeEvent,
    PlayerInteractWithEntityAfterEvent,
    EntityItemPickupBeforeEvent,
    EntityItemPickupAfterEvent,
    EntityItemDropAfterEvent,
    EntitySpawnAfterEvent,
    EntityDamageCause
} from "@minecraft/server";
import * as constants from "./constants.js"
import * as methods from "./methods"
import {
    map,
    regenerateMap,
    validMapsFor2Teams,
    validMapsFor4Teams,
    validMapsFor8Teams,
    BedwarsMap
} from "./maps.js"
import { 
    categories,
    categorySign,
    teamCategorySign,
    teamUpgradeShopitems
} from "./shopitem.js";
import { xp, enabledResources, resourceExperience, pickedResource } from "./xp.js"
import { GameEvent, GameSystem } from "./system.js"
import { newBot } from "./bot.js"
import { award, set, take } from "./awards.js"

/**作为多个methods.eachPlayer调用的简化 */
export function EPsimple(){
    if(map().gameStage!==1) return true;
    methods.eachPlayer(player=>{
        equipmentFunction(player);
    })
}

export function ETsimple(){
    if(map().gameStage!==1) return true;
    methods.eachTeam( team => {
        trapFunction(team);
    });
}

/**对多个methods.eachValidPlayer()方法调用的简化 */
export function EVPsimple(){
    if(map().gameStage!==1) return true;
    methods.eachValidPlayer( player => {
        voidDamageFunction(player)
    });
}

/** 【循环类】等待时 */
export function waitingFunction() {
    if(map().gameStage!==0) return true;
    /** 将在外面的玩家传送回来 */
    if(map().gameStartCountdown>5){
            methods.eachPlayer( player => {
                if ( player.runCommand( `execute if entity @s[x=-12,y=300,z=-12,dx=25,dy=10,dz=25]` ).successCount === 0 && player.getGameMode() !== GameMode.Creative ) {
                    player.setGameMode( GameMode.Adventure ); player.teleport( { x:0, y:304, z:0 } )
                }
                let container = player.getComponent("minecraft:inventory").container
                if( !container.getItem( 4 ) ){
                    container.setItem( 4, methods.itemInfo( "bedwars:special_effect_menu", { amount: 1, itemLock: "slot" } ) )
                }
            } )
    }

    let loadInfo = map().loadInfo;
    /** 加载地图流程 */
    if ( loadInfo.isLoading ) {
        /** 清除原场景 */
        if ( loadInfo.clearingLayer !== 0 ) {
            /** 记分板显示 */
            map().waitingScoreboard( `§f清除原地图中... §7${Math.ceil((loadInfo.clearingLayer*loadInfo.clearTimePerLayer)/20)}秒§r` );
            /** 每隔 loadInfo.clearTimePerLayer 刻，清理一层 */
            if ( system.currentTick % loadInfo.clearTimePerLayer === 0 ) {
                loadInfo.clearingLayer--;
                constants.overworld.runCommand( `fill 0 ${loadInfo.clearingLayer} 0 105 ${loadInfo.clearingLayer} 105 air` );
                constants.overworld.runCommand( `fill 0 ${loadInfo.clearingLayer} 0 -105 ${loadInfo.clearingLayer} 105 air` );
                constants.overworld.runCommand( `fill 0 ${loadInfo.clearingLayer} 0 105 ${loadInfo.clearingLayer} -105 air` );
                constants.overworld.runCommand( `fill 0 ${loadInfo.clearingLayer} 0 -105 ${loadInfo.clearingLayer} -105 air` );
            }
            /** 清除完毕后，加载结构 */
            if ( loadInfo.clearingLayer === 0 ) { map().generateMap(); };
        }
        /** 加载结构等待 */
        else if ( loadInfo.structureLoadTime !== 0 ) {
            /** 记分板显示 */
            map().waitingScoreboard( `§f生成地图中... §7${Math.ceil(loadInfo.structureLoadTime/20)}秒§r` );
            /** 倒计时 */
            loadInfo.structureLoadTime--;
            /** 倒计时结束后，设置队伍岛屿颜色与床 */
            if ( loadInfo.structureLoadTime === 0 ) { map().teamIslandInit() };
        }
        /** 设置队伍岛屿颜色与床等待 */
        else {
            /** 记分板显示 */
            map().waitingScoreboard( "§f设置队伍岛屿中...§r" );
            /** 倒计时 */
            loadInfo.setTeamIslandTime--;
            /** 倒计时结束后，设置等待时间，并关闭加载状态 */
            if ( loadInfo.setTeamIslandTime === 0 ) {
                loadInfo.isLoading = false;
                map().gameStartCountdown = methods.settings.gameStartWaitingTime;
            }
        }
    }
    /** 加载地图结束后，等待时 */
    else {
        /** 大于规定的人数时，开始倒计时 */
        if ( methods.getPlayerAmount() >= methods.settings.minWaitingPlayers ) {
            /** 倒计时 */
            map().gameStartCountdown--;
            /** 记分板显示 */
            map().waitingScoreboard( `§f即将开始： §a${Math.ceil(map().gameStartCountdown/20)}秒§r` );
            /** 提醒玩家还有多长时间开始游戏 */
            methods.eachPlayer( player => {
                if ( map().gameStartCountdown === 399 ) {
                    player.sendMessage( { translate: "message.gameStart", with: [ `20` ] } );
                    player.playSound( "note.hat", { location: player.location } );
                } else if ( map().gameStartCountdown === 199 ) {
                    player.sendMessage( { translate: "message.gameStart", with: [ `§610` ] } );
                    methods.showTitle( player, `§a10`, "", { fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 0 } );
                    player.playSound( "note.hat", { location: player.location } );
                } else if ( map().gameStartCountdown < 100 && map().gameStartCountdown % 20 === 19 ) {
                    const secs = Math.ceil(map().gameStartCountdown/20);
                    player.sendMessage( { translate: "message.gameStart", with: [ `§c${secs}` ] } );
                    methods.showTitle( player, `§c${secs}`, "", { fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 0 } );
                    player.playSound( "note.hat", { location: player.location } );
                }
            } )
            /** 倒计时结束后，开始游戏 */
            if ( map().gameStartCountdown === 0 ) { 
                map().gameStart() ;
            }
        }
        /** 人数不足时，且已经开始倒计时，则取消倒计时 */
        else if ( map().gameStartCountdown < methods.settings.gameStartWaitingTime ) {
            /** 重置倒计时 */
            map().gameStartCountdown = methods.settings.gameStartWaitingTime;
            /** 提醒玩家倒计时已取消 */
            methods.eachPlayer( player => {
                player.sendMessage( { translate: "message.needsMorePlayer" } );
                methods.showTitle( player, "§c等待玩家进入...", "", { fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 0 } );
                player.playSound( "note.hat", { location: player.location } );
            } )
        }
        /** 人数不足且未开始倒计时时，显示等待中 */
        else {
            /** 记分板显示 */
            map().waitingScoreboard( "§f等待中...§r" );
        }
    }
}

/**
 * 掉落战利品
 * @param {EntityDieAfterEvent} event 
 * @returns 
 */
export function dropItems( event ) {
    if( event.deadEntity.isValid === false ) return;

    const dropItem = event.deadEntity?.getDynamicProperty( "drop_item" );
    if ( !dropItem ) return;

    const { itemId, amount } = methods.decodeFromJsonString( dropItem );
    if ( !itemId || isNaN( amount ) || amount <= 0 ) return;

    methods.spawnItem( event.deadEntity.location, itemId, { amount: amount } );
}

/**
 * 钓鱼钩击中实体事件
 * @param {ProjectileHitEntityAfterEvent} event 
 * @returns 
 */
export function hookHitEvent(event){
    if(event.projectile.typeId !== "minecraft:fishing_hook" || !event.projectile.isValid) return;
    if(event.getEntityHit().entity.isValid === false) return;
    if(!methods.playerIsAlive(event.source)) return;

    let container = event.source.getComponent("minecraft:inventory")?.container;
    let item = container?.getItem(event.source.selectedSlotIndex)
    let durability = item?.getComponent("minecraft:durability")

    if (durability) {
        if (durability.damage >= durability.maxDurability - 3) {
            container.setItem(event.source.selectedSlotIndex, undefined);
        } else {
            durability.damage += 3;
        }
    }
    event.getEntityHit().entity?.applyDamage(0.0001,{damagingEntity: methods.playerIsValid(event.source) ? event.source : undefined, damagingProjectile: event.projectile})
    event.projectile.kill()
}

/**
 * 使用钓鱼竿事件
 * @param {ItemUseAfterEvent} event 
 * @returns 
 */
export function playerUseFishingRodEvent(event){
    if( event.itemStack.typeId !== "minecraft:fishing_rod" ) return;
    if( !methods.playerIsAlive(event.source) ) return;

    let container = event.source.getComponent("minecraft:inventory")?.container;
    let item = container?.getItem(event.source.selectedSlotIndex)
    let durability = item?.getComponent("minecraft:durability")

    if (durability) {
        if (durability.damage >= durability.maxDurability - 3) {
            container.setItem(event.source.selectedSlotIndex, undefined);
        } else {
            durability.damage += 3;
        }
    }
}

/**
 * 音波攻击
 * @param {ProjectileHitEntityAfterEvent} event 
 */
export function sonicHitEvent( event ){
    if( event.projectile?.typeId !== "bedwars:sonic_bomb" || !event.projectile.isValid ) return;
    if( event.getEntityHit().entity?.isValid === false ) return;
    
    let tar = event.getEntityHit().entity;
    let player = event.source;
    let projectile = event.projectile;
    const duration = Number(player.bedwarsInfo?.itemUseDuration?.["bedwars:sonic_bomb"] ?? 0);
    const damage = 4 * duration;
    if (!tar?.isValid || !Number.isFinite(damage) || damage <= 0) return;

    tar.applyDamage(damage, { damagingEntity: player, cause: "sonicBoom" });
    tar.applyKnockback( { x: (tar.location.x - projectile.location.x) * 8, z: (tar.location.z - projectile.location.z) * 8 }, (tar.location.y - projectile.location.y) * 4 );
    if (tar.typeId === "minecraft:player") tar.playSound( "mob.warden.sonic_boom", { location: tar.location, volume: 2 } );
}


/** 【事件类】玩家破坏方块事件，包括破坏原版方块的检测和破坏床的检测
 * @param {PlayerBreakBlockBeforeEvent} event 
 */
export function playerBreakBlockEvent( event ) {

    let blockId = event.block.typeId;

    // 如果玩家破坏的方块是原版方块，且不属于在 constants.breakableVanillaBlocksByPlayer 数组中的可破坏方块，则防止玩家破坏方块
    if ( blockId.includes( "minecraft:" ) && !constants.breakableVanillaBlocksByPlayer.includes( blockId ) && !methods.settings.CreativePlayerCanBreakBlocks ) {
        let breaker = event.player;
        system.run( () => {
            methods.warnPlayer( breaker, { translate: "message.breakingInvalidBlocks" } );
        } );
        event.cancel = true;
    }

    // 如果玩家破坏的方块是床，进行判定
    if ( event.block.typeId === "minecraft:bed" ) {
        /** 获取基本信息 */
        let breaker = event.player;
        /** @type {methods.BedwarsPlayer}*/ let breakerInfo = breaker.bedwarsInfo;
        let teamList = map().teamList;
        system.run( () => {
            /** 获取被破坏的床所属的队伍 | 可能返回 undefined */
            let team = teamList.filter( team => { return constants.overworld.getBlock( team.bedInfo.pos ).typeId === "minecraft:air" && team.bedInfo.isExist === true } )[0];
            if ( team !== undefined ){
                /** 被无信息的玩家破坏时 */
                if ( !methods.playerIsValid( breaker ) || breakerInfo.team === undefined ) { team.bedDestroyedByInvalidPlayer( breaker ) }
                /** 被自己队伍的玩家破坏时 */
                else if ( breakerInfo.team === team.id ) { team.bedDestroyedBySelfPlayer( breaker ); }
                /** 被其他队的玩家破坏时 */
                else { team.bedDestroyedByOtherPlayer( breaker ); };
                // 移除床的掉落物
                methods.removeItem( "minecraft:bed" );
            }
        } )
    }

    if ( event.block.typeId === "bedwars:amethyst_block" ){
        let breaker = event.player;
        system.run( () => {
            breaker.sendMessage("你似乎打碎了什么东西...")
            methods.getPlayerNearby(breaker.location,50).forEach( player => {
                if( player.name === breaker.name ) return;
                player.playSound("break.amethyst_block", {location:player.location,volume:10,pitch:1})
                player.sendMessage("远处传来了一阵清脆的破碎声...")
            })
        })
    }else{
        let blocksNearBy = [
            event.block.dimension.getBlock({x: event.block.location.x, y: event.block.location.y+1, z: event.block.location.z}).typeId,
            event.block.dimension.getBlock({x: event.block.location.x, y: event.block.location.y-1, z: event.block.location.z}).typeId,
            event.block.dimension.getBlock({x: event.block.location.x+1, y: event.block.location.y, z: event.block.location.z}).typeId,
            event.block.dimension.getBlock({x: event.block.location.x-1, y: event.block.location.y, z: event.block.location.z}).typeId,
            event.block.dimension.getBlock({x: event.block.location.x, y: event.block.location.y, z: event.block.location.z+1}).typeId,
            event.block.dimension.getBlock({x: event.block.location.x, y: event.block.location.y, z: event.block.location.z-1}).typeId
        ]
        if(blocksNearBy.includes("bedwars:amethyst_block")){
            let breaker = event.player;
            system.run( () => {
                methods.getPlayerNearby(breaker.location,30).forEach( player => {
                    if( player.name === breaker.name ) return;
                    player.playSound("break.amethyst_block", {location:player.location,volume:10,pitch:1})
                    player.sendMessage("远处传来了一阵清脆的破碎声...")
                })
            })
        }
    }
}

/**
 * 
 * @param {PlayerInventoryItemChangeAfterEvent} event 
 */
export function fastShopFunction(event){
    let player = event.player;
    let nItemStack = event.itemStack;
    let bItemStack = event.beforeItemStack;
    let playerInfo = player.bedwarsInfo;

    if(!bItemStack) return;

    if (nItemStack?.typeId.includes("bedwars:shopitem_") || nItemStack?.typeId === "minecraft:trapped_chest") {
        player.getComponent("minecraft:inventory").container.setItem( event.slot )
        let emptySlot = player.getComponent("minecraft:inventory").container.firstEmptySlot();

        if (emptySlot === event.slot) {
            categories[playerInfo.category[0]].forEach(shopitem => {
                if (nItemStack.typeId === shopitem.shopitemId) {
                    switch (playerInfo.category[0]) {
                        case 1:
                        case 2:
                        case 3:
                        case 6:
                            shopitem.playerPurchaseItems(player);
                            break;
                        default:
                            shopitem.setColoredId(playerInfo.team);
                            let maxAmount = methods.itemInfo(shopitem.itemId).maxAmount;
                            let xp = shopitem.getCostXP();
                            let amount = player.level >= xp * Math.floor(maxAmount / shopitem.itemAmount) ? Math.floor(maxAmount / shopitem.itemAmount) : Math.floor(player.level / xp);

                            for (; amount > 0; amount--) {
                                shopitem.playerPurchaseItems(player);
                            }
                            break;
                    }
                }
            });
        } else if (player.clientSystemInfo.platformType === PlatformType.Mobile) {
            categories[playerInfo.category[0]].forEach(shopitem => {
                if (nItemStack.typeId === shopitem.shopitemId) {
                    shopitem.playerPurchaseItems(player);
                }
            });
        }
    }

    if (nItemStack?.typeId.includes("bedwars:upgrade_")) {
        player.getComponent("minecraft:inventory").container.setItem(event.slot, undefined);
        teamUpgradeShopitems[playerInfo.category[1]].forEach(shopitem => {
            if (nItemStack.typeId === shopitem.shopitemId) {
                shopitem.playerPurchaseItems(player);
            }
        });
    }

    if (nItemStack?.typeId.includes("bedwars:category_")) {
        let already = false
        for(let i = 0; i < categorySign.length; i++){
            if(categorySign[i] === nItemStack.typeId){
                playerInfo.category[0] = i
                already = true
                break;
            }
        }
        for(let i = 0; i < teamCategorySign.length && already === false; i++){
            if(teamCategorySign[i] === nItemStack.typeId){
                playerInfo.category[1] = i
                break;
            }
        }
        player.getComponent("minecraft:inventory").container.setItem(event.slot, undefined)
    }
}

/**
 * 
 * @param {PlayerSwingStartAfterEvent} event 
 */
export function fastStoreFunction( event ){
    let player = event.player
    let item = event.heldItemStack
    let block = player.getBlockFromViewDirection({includeLiquidBlocks:false,includePassableBlocks:true,maxDistance:7})?.block

    if(!item) return;
    if(!block) return;
    if(!methods.playerIsAlive(player)) return;
    if(event.swingSource !== EntitySwingSource.Mine) return;

    let pCon = player.getComponent("minecraft:inventory").container
    let eCon = player.getComponent("minecraft:ender_inventory").container

    if(block?.typeId === "minecraft:chest"){
        let cCon = block.getComponent("minecraft:inventory")?.container
        if(methods.transferItem(pCon,player.selectedSlotIndex,cCon,-1)){
            player.sendMessage(`成功存入手持物品!`)
            player.playSound("random.chestclosed", { volume: 3 })
        }else{
            player.sendMessage("无法存入该物品!")
            player.playSound("mob.villager.no", { volume: 3 })
        }
    }else if ( block?.typeId === "minecraft:ender_chest" ) {
        if(methods.transferItem(pCon,player.selectedSlotIndex,eCon,-1)){
            player.sendMessage(`成功存入手持物品!`)
            player.playSound("random.enderchestclosed", { volume: 3 })
        }else{
            player.sendMessage("无法存入该物品!")
            player.playSound("mob.villager.no", { volume: 3 })
        }
    }
}

export function xp( event ){
    let player = event.entity;
    if( player.typeId !== "minecraft:player" ) return;
    let item = event.item;

    if(enabledResources.includes(item.getComponent("minecraft:item").itemStack.typeId) && methods.playerIsAlive(player)){
        let totalXp = item.getComponent("minecraft:item").itemStack.amount * resourceExperience[item.getComponent("minecraft:item").itemStack.typeId]
        event.cancel = true
        if(pickedResource.includes(item.id)) return;
        pickedResource.push(item.id)
        system.run(()=>{
            player.addLevels(totalXp);
            player.playSound("random.orb", {location: player.location, volume: 1 });
            item.remove()
        })
    }
}

/**
 * 【事件类】玩家喝下药水&魔法牛奶事件，提供药效或魔法牛奶对应标记效果
 * @param {ItemCompleteUseAfterEvent} event 
 */
export function playerUseItemEvent( event ) {
    let itemType = event.itemStack.typeId;
    let player = event.source;
    let pos = methods.copyPosition(player.location)
    /** @type {methods.BedwarsPlayer} */ let playerInfo = event.source.bedwarsInfo;
    switch ( itemType ) {
        case "minecraft:golden_apple":
            event.source.runCommand(`effect @s clear absorption`)
            event.source.addEffect( "absorption", 600, { amplifier: 0 })
            break;
        case "minecraft:enchanted_golden_apple":
            player.removeEffect("absorption")
            player.removeEffect("resistance")
            player.removeEffect("fire_resistance")
            player.addEffect("absorption", 1200, {amplifier:1})
            player.addEffect("resistance", 600, {amplifier:0})
            player.addEffect("fire_resistance", 1800, {amplifier:0})
            break;
        case "bedwars:suspicious_stew":
            const effects = [
                ()=>{player.addEffect("regeneration", 200, { amplifier: 2 })},
                ()=>{player.addEffect("strength", 200, { amplifier: 1 })},
                ()=>{player.addEffect("speed", 200, { amplifier: 2 })},
                ()=>{player.addEffect("absorption", 300, { amplifier: 3 })},
                ()=>{player.addEffect("haste", 200, { amplifier: 2 })},
                ()=>{player.addEffect("wither", 200, { amplifier: 1 })},
                ()=>{player.addEffect("weakness", 200, { amplifier: 1 })},
                ()=>{player.addEffect("slowness", 400, { amplifier: 1 })},
                ()=>{player.addEffect("poison", 200, { amplifier: 2 })},
                ()=>{player.addEffect("mining_fatigue", 300, { amplifier: 1 })}
            ];
            effects[methods.randomInt(0,9)]();
            break;
        case "bedwars:potion_jump_boost":
            event.source.addEffect( "jump_boost", 900, { amplifier: 4 } );
            break;
        case "bedwars:potion_speed":
            event.source.addEffect( "speed", 900, { amplifier: 1 } );
            break;
        case "bedwars:potion_invisibility":
            event.source.addEffect( "invisibility", 600, { amplifier: 0 } );
            event.source.triggerEvent( "hide_armor" )
            break;
        case "bedwars:potion_strength_1":
            event.source.addEffect( "strength", 900, { amplifier: 0 } );
            break;
        case "bedwars:potion_instant_health_1":
            event.source.runCommand(`effect @s instant_health 1 0`);
            break;
        case "bedwars:potion_instant_health_2":
            event.source.runCommand(`effect @s instant_health 1 1`);
            break;
        case "bedwars:potion_fire_resistance":
            event.source.addEffect( "fire_resistance", 1200, { amplifier: 0 } );
            break;
        case "bedwars:potion_resistance":
            event.source.addEffect( "resistance", 400, { amplifier: 0 } );
            break;
        case "bedwars:honey_bottle":
            player.removeEffect("slowness")
            player.removeEffect("weakness")
            player.removeEffect("mining_fatigue")
            player.removeEffect("wither")
            player.removeEffect("poison")
            player.removeEffect("hunger")
            player.removeEffect("nausea")
            player.removeEffect("blindness")
            player.removeEffect("darkness")
            player.removeEffect("levitation")
            player.removeEffect("fatal_poison")
            break;
        case "bedwars:magic_milk": 
            if ( methods.playerIsValid( event.source ) ) {
                event.source.bedwarsInfo.magicMilk.enabled = true;
                system.runTimeout(()=>{            
                    event.source.sendMessage( { translate: "message.magicMilkTimeOut" } )
                    playerInfo.magicMilk.enabled = false
                },600)
            }
        break;
        case "bedwars:rescue_platform":
            player.clearVelocity()
            player.runCommand(`fill ${player.location.x-2} ${player.location.y-1} ${player.location.z-2} ${player.location.x+2} ${player.location.y-1} ${player.location.z+2} slime keep`);
            player.runCommand(`fill ${player.location.x-1} ${player.location.y-1} ${player.location.z-3} ${player.location.x-1} ${player.location.y-1} ${player.location.z+3} slime keep`);
            player.runCommand(`fill ${player.location.x+1} ${player.location.y-1} ${player.location.z-3} ${player.location.x+1} ${player.location.y-1} ${player.location.z+3} slime keep`);
            player.runCommand(`fill ${player.location.x-3} ${player.location.y-1} ${player.location.z-1} ${player.location.x+3} ${player.location.y-1} ${player.location.z-1} slime keep`);
            player.runCommand(`fill ${player.location.x-3} ${player.location.y-1} ${player.location.z+1} ${player.location.x+3} ${player.location.y-1} ${player.location.z+1} slime keep`);
            system.runTimeout(()=>{
                player.runCommand(`fill ${pos.x-3} ${pos.y-1} ${pos.z-3} ${pos.x+3} ${pos.y-1} ${pos.z+3} air replace minecraft:slime`)
            },150)
            if(player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex).amount === 1){
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,undefined)
            }else{
                let item = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex)
                item.amount--
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,item)
            }
            break;
        case "bedwars:trampoline":
            player.runCommand(`fill ${pos.x-2} ${pos.y-5} ${pos.z+1} ${pos.x+2} ${pos.y-5} ${pos.z-1} honey_block keep`)
            player.runCommand(`fill ${pos.x-1} ${pos.y-5} ${pos.z+2} ${pos.x+1} ${pos.y-5} ${pos.z-2} honey_block keep`)
            system.runTimeout(()=>{
                player.runCommand(`fill ${pos.x-2} ${pos.y-5} ${pos.z-2} ${pos.x+2} ${pos.y-5} ${pos.z+2} air replace minecraft:honey_block`)
            },200)
            if(player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex).amount === 1){
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,undefined)
            }else{
                let item = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex)
                item.amount--
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,item)
            }
            break;
        case "bedwars:flying_cloud":
            let cloud = player.dimension.spawnEntity("bedwars:flying_cloud", {x:player.location.x, y:player.location.y-1, z:player.location.z}, {spawnEffect: "poof"})
            system.runTimeout(()=>{
                cloud.remove()
            },200)
            GameSystem.Interval(()=>{
                return flyingCloudEvent(player,cloud)
            },5,{tag: "flyingCloudInterval"})
            if(player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex).amount === 1){
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,undefined)
            }else{
                let item = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex)
                item.amount--
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,item)
            }
            break;
        case "bedwars:tp_scroll_1":
            const x = event.source.location.x;
            const y = event.source.location.y;
            const z = event.source.location.z;
            let team
            methods.eachTeam((BedwarsTeam) => {
                if(BedwarsTeam.id === player.bedwarsInfo.team){
                    team = BedwarsTeam
                }
            })
            let toX = team.spawnpoint.x;
            let toY = team.spawnpoint.y;
            let toZ = team.spawnpoint.z;
            playerInfo.scroll.time=0;
            player.getComponent("minecraft:equippable").setEquipment(EquipmentSlot.Mainhand,methods.itemInfo("bedwars:tp_scroll_2",{lore:["§r§5正在传送中...","§r§2右键以取消传送"], itemLock: "inventory"}));
            methods.particleCircle(x,y,z,"minecraft:dragon_breath_trail",player)
            methods.particleCircle(toX,toY,toZ,"minecraft:dragon_breath_trail",player)
            player.sendMessage("正在传送中...请等待5秒")
            system.runTimeout(()=>{
                if(playerInfo.scroll.time===102)return;
                if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                    methods.particleCircle(x,y+0.2,z,"minecraft:dragon_breath_trail",player)
                    methods.particleCircle(toX,toY+0.2,toZ,"minecraft:dragon_breath_trail",player)
                    system.runTimeout(()=>{
                        if(playerInfo.scroll.time===102)return;
                        if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                            methods.particleCircle(x,y+0.4,z,"minecraft:dragon_breath_trail",player)
                            methods.particleCircle(toX,toY+0.4,toZ,"minecraft:dragon_breath_trail",player)
                            player.sendMessage("正在传送中...请等待4秒")
                            system.runTimeout(()=>{
                                if(playerInfo.scroll.time===102)return;
                                if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                    methods.particleCircle(x,y+0.6,z,"minecraft:dragon_breath_trail",player)
                                    methods.particleCircle(toX,toY+0.6,toZ,"minecraft:dragon_breath_trail",player)
                                    system.runTimeout(()=>{
                                        if(playerInfo.scroll.time===102)return;
                                        if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                            methods.particleCircle(x,y+0.8,z,"minecraft:dragon_breath_trail",player)
                                            methods.particleCircle(toX,toY+0.8,toZ,"minecraft:dragon_breath_trail",player)
                                            player.sendMessage("正在传送中...请等待3秒")
                                            system.runTimeout(()=>{
                                                if(playerInfo.scroll.time===102)return;
                                                if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                                    methods.particleCircle(x,y+1,z,"minecraft:dragon_breath_trail",player)
                                                    methods.particleCircle(toX,toY+1,toZ,"minecraft:dragon_breath_trail",player)
                                                    system.runTimeout(()=>{
                                                        if(playerInfo.scroll.time===102)return;
                                                        if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                                            methods.particleCircle(x,y+1.2,z,"minecraft:dragon_breath_trail",player)
                                                            methods.particleCircle(toX,toY+1.2,toZ,"minecraft:dragon_breath_trail",player)
                                                            player.sendMessage("正在传送中...请等待2秒")
                                                            system.runTimeout(()=>{
                                                                if(playerInfo.scroll.time===102)return;
                                                                if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                                                    methods.particleCircle(x,y+1.4,z,"minecraft:dragon_breath_trail",player)
                                                                    methods.particleCircle(toX,toY+1.4,toZ,"minecraft:dragon_breath_trail",player)
                                                                    system.runTimeout(()=>{
                                                                        if(playerInfo.scroll.time===102)return;
                                                                        if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                                                            methods.particleCircle(x,y+1.6,z,"minecraft:dragon_breath_trail",player)
                                                                            methods.particleCircle(toX,toY+1.6,toZ,"minecraft:dragon_breath_trail",player)
                                                                            player.sendMessage("正在传送中...请等待1秒")
                                                                            system.runTimeout(()=>{
                                                                                if(playerInfo.scroll.time===102)return;
                                                                                if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                                                                    methods.particleCircle(x,y+1.8,z,"minecraft:dragon_breath_trail",player)
                                                                                    methods.particleCircle(toX,toY+1.8,toZ,"minecraft:dragon_breath_trail",player)
                                                                                    system.runTimeout(()=>{
                                                                                    if(playerInfo.scroll.time===102)return;
                                                                                    if(Math.floor(player.location.x)===Math.floor(x) && Math.floor(player.location.y)===Math.floor(y) && Math.floor(player.location.z)===Math.floor(z)){
                                                                                        playerInfo.teleportPlayerToSpawnpoint()     //!
                                                                                        player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`)
                                                                                        player.sendMessage("传送成功!")
                                                                                    }else{
                                                                                        player.sendMessage("传送失败!")
                                                                                        player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                                                                        player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                                                                    }
                                                                                },10);
                                                                                }else{
                                                                                    player.sendMessage("传送失败!")
                                                                                    player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                                                                    player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                                                                }
                                                                            },10)
                                                                        }else{
                                                                            player.sendMessage("传送失败!")
                                                                            player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                                                            player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                                                        }
                                                                    },10)
                                                                }else{
                                                                    player.sendMessage("传送失败!")
                                                                    player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                                                    player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                                                }
                                                            },10)
                                                        }else{
                                                            player.sendMessage("传送失败!")
                                                            player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                                            player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                                        }
                                                    },10)
                                                }else{
                                                    player.sendMessage("传送失败!")
                                                    player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                                    player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                                }
                                            },10)
                                        }else{
                                            player.sendMessage("传送失败!")
                                            player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                            player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                        }
                                    },10)
                                }else{
                                    player.sendMessage("传送失败!")
                                    player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                                    player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                                }
                            },10)
                        }else{
                            player.sendMessage("传送失败!")
                            player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                            player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                        }
                    },10)
                }else{
                    player.sendMessage("传送失败!")
                    player.runCommand(`clear @s bedwars:tp_scroll_2 0 1`);
                    player.runCommand(`give @s bedwars:tp_scroll_1 1`);
                }
            },10)
            break;
        case "bedwars:tp_scroll_2":
            player.bedwarsInfo.scroll.time = 102
            player.getComponent("minecraft:equippable").setEquipment(EquipmentSlot.Mainhand,methods.itemInfo("bedwars:tp_scroll_1"));
            player.sendMessage(`传送已取消!`);
            break;
        case "bedwars:firework":
            player.runCommand(`clear @s bedwars:firework 0 1`)
            player.dimension.playSound("firework.launch",player.location ,{ pitch:1, volume:5})
            system.runTimeout( ()=> {
                player.dimension.playSound("firework.large_blast",player.location, {pitch:1, volume:10})
                player.applyDamage(0)
            },20)
            player.applyKnockback( {x:0,z:0}, 1.8)
            break;
        case "bedwars:scratch_card":
            const rewards = [
                ...Array.from({ length: 4 },() => () => { player.sendMessage("啊哦,下次手气可能会好点吧...")}),
                ...Array.from({ length: 3 },() => () => {
                    let random = methods.randomInt(50,100)
                    player.addLevels(random)
                    player.sendMessage(`三等奖!获得了 ${random} 点经验!`)
                }),
                ...Array.from({ length: 2 },() => () => {
                    let random = methods.randomInt(4,8)
                    player.runCommand(`give @s bedwars:diamond ${random}`)
                    player.sendMessage(`二等奖!获得了 ${random} 颗钻石!`)
                }),
                () => {
                    let xp = methods.randomInt(50,150)
                    let diamond = methods.randomInt(4,10)
                    player.runCommand(`give @s bedwars:diamond ${diamond}`)
                    player.addLevels(xp)
                    player.sendMessage(`一等奖!获得了 ${xp} 点经验和 ${diamond} 颗钻石`)
                }
            ]
            rewards[methods.randomInt(0,9)]()
            break;
        case "bedwars:special_effect_menu":
            methods.showPlayerUI( player, "specialEffect")
            break;
        case "bedwars:mini_drill":
            let block = player.getBlockFromViewDirection( { includeLiquidBlocks: false, includePassableBlocks: false, maxDistance: 6})?.block
            let transEvent = { cancel: false, player: player, block: block, dimension: player.dimension, itemStack: event.itemStack }
            if( !block ){
                player.startItemCooldown( "mini_drill", 0 )
                return;
            }
            playerBreakBlockEvent(transEvent)
            if(transEvent.cancel === false && block){
                constants.overworld.setBlockType( block.location, "minecraft:air" )
                constants.overworld.spawnParticle( "minecraft:basic_flame_particle", methods.centerPosition( block.location ) )
                constants.overworld.spawnParticle( "minecraft:dust_plume", methods.centerPosition( block.location ) )
                constants.overworld.playSound( "random.fizz", player.location, { volume: 5 } )
                if(player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex).amount === 1){
                    player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,undefined)
                }else{
                    let item = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex)
                    item.amount--
                    player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,item)
                }
            }else{
                player.startItemCooldown( "mini_drill", 0 )
            }
            break;
        case "minecraft:bow":
            if( map().gameStage == 1 && map().randomEventInfo.triggered == true ){
                switch( map().randomEventInfo.id ){
                    case "wither_living":
                        if( event.itemStack.getComponent("minecraft:enchantable").getEnchantments().some( enchantment => enchantment.type === "minecraft:power" ) ){
                            let arrow = constants.overworld.getEntities( { location: methods.posPlus( player.location, { x: 0, y: 1.5, z: 0 } ), maxDistance: 2, type: "minecraft:arrow" } ).filter( entity => entity.getComponent("minecraft:projectile").owner.id === player.id )[0]
                            let skull = constants.overworld.spawnEntity( "minecraft:wither_skull_dangerous", arrow.location )
                            skull.getComponent("minecraft:projectile").shoot( arrow.getVelocity(), { uncertainty: 0 } )
                        }else{
                            let arrow = constants.overworld.getEntities( { location: methods.posPlus( player.location, { x: 0, y: 1.5, z: 0 } ), maxDistance: 2, type: "minecraft:arrow" } ).filter( entity => entity.getComponent("minecraft:projectile").owner.id === player.id )[0]
                            let skull = constants.overworld.spawnEntity( "minecraft:wither_skull", arrow.location )
                            skull.getComponent("minecraft:projectile").shoot( arrow.getVelocity(), { uncertainty: 0 } )
                        }
                        break;
                    case "sky-piercing_arrow":
                        let arrow = constants.overworld.getEntities( { location: methods.posPlus( player.location, { x: 0, y: 1.5, z: 0 } ), maxDistance: 2, type: "minecraft:arrow" } ).filter( entity => entity.getComponent("minecraft:projectile").owner.id === player.id )[0]
                        arrow.triggerEvent( "no_gravity" )
                        break;
                }
            }
            break;
        case "bedwars:chorus_pearl":
            methods.object_print(new ItemStack( "minecraft:chorus_fruit" , 1).getComponents())
            player.eatItem( methods.itemInfo( "minecraft:chorus_fruit", 1) )
    }
}

/**
 * @param {ItemStartUseAfterEvent} event
 */
export function startUseEvent(event){
    let player = event.source
    switch(event.itemStack?.typeId){
        case "bedwars:parachute":
            player.addEffect("slow_falling",200)
            break;
        /*case "bedwars:fireball":
world.sendMessage("@")
            player.setDynamicProperty( "prop.fireball.using", true)
            GameSystem.Interval( () => {
                return usingFireball( player )
            }, 2, { tag: "Interval:usingFireball", tick: 0 })
            break;*/
    }
}

/**
 * @param {ItemStopUseAfterEvent} event 
 */
export function stopUseEvent(event){
    let player = event.source
    if(!event.itemStack) return;
    switch(event.itemStack.typeId){
        case "bedwars:parachute":
            player.removeEffect("slow_falling")
            if(player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex).amount === 1){
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,undefined)
            }else{
                let item = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex)
                item.amount--
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,item)
            }
            player.playSound("random.break",{location:player.location,volume:3})
            break;
        case "bedwars:sonic_bomb":
            player.bedwarsInfo.itemUseDuration["bedwars:sonic_bomb"] = (80 - event.useDuration) / 20

            const startPos = player.getHeadLocation();
            const dir = player.getViewDirection();
            const maxDistance = 64;
            const step = 0.5;
            let traveled = 0;

            while (traveled <= maxDistance) {
                const point = {
                    x: startPos.x + dir.x * traveled,
                    y: startPos.y + dir.y * traveled,
                    z: startPos.z + dir.z * traveled
                };
                player.dimension.spawnParticle("minecraft:sonic_explosion", point);

                const block = player.dimension.getBlock(point);
                if (block?.typeId !== "minecraft:air") break;

                traveled += step;
            }
            const target = player.getEntitiesFromViewDirection( { maxDistance: 64 } )[0]?.entity;
            if (target) {
                let loc = {
                    x: target.location.x - (target.location.x - player.location.x) / (Math.abs(target.location.x - player.location.x) + Math.abs(target.location.z - player.location.z)),
                    y: target.location.y,
                    z: target.location.z - (target.location.z - player.location.z) / (Math.abs(target.location.x - player.location.x) + Math.abs(target.location.z - player.location.z)),
                }
                const fakeEvent = {
                    projectile: { typeId: "bedwars:sonic_bomb", isValid: true, location: loc },
                    source: player,
                    getEntityHit: () => ({ entity: target })
                };
                sonicHitEvent(fakeEvent);
            }
            if(player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex).amount === 1){
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,undefined)
            }else{
                let item = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex)
                item.amount--
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,item)
            }
            constants.overworld.playSound( "mob.warden.sonic_boom", player.location, { volume: 20 } );
            break;
        case "minecraft:bow":
            if( event.useDuration <= 3 ) break;

            const drawTicks = Math.min( event.useDuration, 20 );
            const pullStrength = drawTicks * ( drawTicks + 40 ) / 1200;
            const arrowSpeed = pullStrength * 60;
            const arrowStart = player.getHeadLocation();
            const aimDirection = player.getViewDirection();
            const arrowLocation = {
                x: arrowStart.x + aimDirection.x * 0.5,
                y: arrowStart.y + aimDirection.y * 0.5,
                z: arrowStart.z + aimDirection.z * 0.5
            };
            const arrowVelocity = {
                x: aimDirection.x * arrowSpeed,
                y: aimDirection.y * arrowSpeed,
                z: aimDirection.z * arrowSpeed
            };

            const arrowPositionAt = (seconds) => ({
                x: arrowLocation.x + arrowVelocity.x * seconds,
                y: arrowLocation.y + arrowVelocity.y * seconds,
                z: arrowLocation.z + arrowVelocity.z * seconds
            });

            if( map().gameStage == 1 && map().randomEventInfo.triggered == true ){
                switch( map().randomEventInfo.id ){
                    case "wither_living":
                        if( event.itemStack.getComponent("minecraft:enchantable").getEnchantments().some( enchantment => enchantment.type.id == "power" ) ){
                            let arrow = constants.overworld.getEntities( { location: arrowPositionAt(0.05), maxDistance: 3, type: "minecraft:arrow" } ).filter( entity => entity.getComponent("minecraft:projectile").owner.id === player.id )[0]
                            let skull = constants.overworld.spawnEntity( "minecraft:wither_skull_dangerous", arrow?.location )
                            skull?.getComponent("minecraft:projectile").shoot( arrow.getVelocity(), { uncertainty: 0 } )
                            arrow.remove()
                        }else{
                            let arrow = constants.overworld.getEntities( { location: arrowPositionAt(0.05), maxDistance: 3, type: "minecraft:arrow" } ).filter( entity => entity.getComponent("minecraft:projectile").owner.id === player.id )[0]
                            let skull = constants.overworld.spawnEntity( "minecraft:wither_skull", arrow?.location )
                            skull?.getComponent("minecraft:projectile").shoot( arrow.getVelocity(), { uncertainty: 0 } )
                            arrow.remove()
                        }
                        break;
                    case "sky-piercing_arrow":
                        let arrow = constants.overworld.getEntities( { location: arrowPositionAt(0.05), maxDistance: 3, type: "minecraft:arrow" } ).filter( entity => entity.getComponent("minecraft:projectile").owner.id === player.id )[0]
                        arrow?.triggerEvent( "no_gravity" )
                        break;
                }
            }
            break;
    }
}

/**
 * 
 * @param {ProjectileHitEntityAfterEvent} event 
 */
export function arrowHit(event){
    if(event.projectile.typeId!=="minecraft:arrow")return;
    if(event.source.typeId!=="minecraft:player")return;
    let entity = event.getEntityHit().entity
    event.source.playSound("random.orb",{location:event.source.location,pitch:0.5,volume:5})
    event.source.sendMessage(`${entity.nameTag===undefined? entity.typeId : entity.nameTag} 剩余 ${Math.round(entity.getComponent("minecraft:health").currentValue)}§c❤!`)
}

/**
 * 反弹烈焰弹
 * @param {EntityHitEntityAfterEvent} event 
 */
export function reboundFireball( event ){
    if(event.damagingEntity.typeId !== "minecraft:player") return;
    if(event.hitEntity.typeId !== "bedwars:fireball") return;

    let player = event.damagingEntity
    let view = player.getViewDirection()
    let fireball = event.hitEntity

    fireball.getComponent("minecraft:projectile").shoot({x: view.x, y: view.y , z: view.z},{ uncertainty: 0 })
}

/**
 * 玩家近战攻击
 * @param {EntityHitEntityAfterEvent} event
 */
export function playerHitEvent( event ){
    let damagingEntity = event.damagingEntity
    let hitEntity = event.hitEntity
    let handItem = damagingEntity.getComponent("minecraft:inventory").container.getItem( damagingEntity.selectedSlotIndex )

    if( damagingEntity.typeId !== "minecraft:player" ) return;
    if( !methods.playerIsAlive( damagingEntity ) ) return;

    switch( handItem?.typeId ){
        case "bedwars:copper_sword":
            if( hitEntity.typeId == "minecraft:player" && damagingEntity.bedwarsInfo?.team == hitEntity.bedwarsInfo?.team ) break;
            if( hitEntity.team == damagingEntity.bedwarsInfo?.team ) break;
            methods.randomInt(1,2) == 1 ? hitEntity.addEffect( "fatal_poison", 200, { amplifier: 1 } ) : null
            break;
    }

}

/**
 * [循环类] 筋斗云事件
 * @param {Player} player
 * @param {Entity} cloud
 */
export function flyingCloudEvent( player, cloud ){
    if(map().gameStage!==1) return true;
    if(!player.isValid) return true;
    if(!player.bedwarsInfo) return true;
    if(cloud.isValid === false) return true;
    if(cloud.typeId !== "bedwars:flying_cloud") return true;

    cloud.applyImpulse({x:player.getVelocity().x,y:0,z:player.getVelocity().z})
    cloud.teleport({x:player.location.x, y:player.location.y-1, z:player.location.z},{keepVelocity:true})
}

/**
 * 以太珍珠事件
 * @param {EntitySpawnAfterEvent} event 
 */
export function etherPearlEvent( event ){
    if( event.entity.typeId !== "bedwars:ether_pearl" ) return;

    let entity = event.entity
    let owner = entity.getComponent("minecraft:projectile").owner
    let ride = entity.getComponent("minecraft:rideable")

    ride.addRider( owner );
}

/**
 * 【事件类】玩家扔出床虱事件，在砸中的位置生成蠹虫
 * @param {ProjectileHitEntityAfterEvent | ProjectileHitBlockAfterEvent} event 
 */
export function bedBugEvent( event ) {
    if ( event.projectile.typeId === "bedwars:bed_bug" ) {
        /** 在砸中的位置生成一只蠹虫 */
        let silverfish = event.dimension.spawnEntity( "minecraft:silverfish", event.location ); 
        let thrower = event.source

        if ( methods.playerIsValid( thrower ) ) {
            /** @type {methods.BedwarsPlayer} */let throwerInfo = thrower.bedwarsInfo;

            /** 设置为玩家的队伍，并设置蠹虫的消失时间和名字的时间条 */
            silverfish.triggerEvent( `team_${throwerInfo.team}` );
            silverfish.team = throwerInfo.getTeam( )
            system.runTimeout(()=>{
                if(silverfish){
                    silverfish.remove()
                }
            },300)
        }
    }
}

/**
 * 【事件类】玩家扔出末影珍珠事件
 * @param {ProjectileHitEntityAfterEvent | ProjectileHitBlockAfterEvent} event 
 */
export function enderPearlEvent(event){
    if(event.projectile.typeId === "minecraft:ender_pearl"){
        event.source.teleport(canTeleport(event.location,event.source),{keepVelocity:false})
    }
}

/**
 * 以太珍珠落地
 * @param {ProjectileHitBlockAfterEvent} event 
 */
export function etherPearlHitBlcok( event ){
    let entity = event.projectile
    if( entity.typeId !== "bedwars:ether_pearl" ) return;

    let player = event.source
    player.applyDamage( 5, { cause: EntityDamageCause.fall })
}

/**
 * 以太珍珠落地
 * @param {ProjectileHitEntityAfterEvent} event 
 */
export function etherPearlHitEntity( event ){
    let entity = event.projectile
    if( entity.typeId !== "bedwars:ether_pearl" ) return;

    let player = event.source
    player.applyDamage( 5, { cause: EntityDamageCause.fall })
}

/**
 * 【方法类】检查pos是否可以tp,返回可tp的pos
 * @param {Vector3} pos
 * @returns {Vector3}
 */
export function canTeleport(pos,player){
    if(constants.overworld.getBlock(pos).typeId !== "minecraft:air"){
        if(constants.overworld.getBlock({x:pos.x,y:pos.y-2,z:pos.z}).typeId === "minecraft:air"){
            return {x:pos.x,y:pos.y-2,z:pos.z}
        }else{
            let x,z
            Math.abs(Math.round(pos.x)-pos.x) < 0.01? x=Math.round(pos.x) : x=pos.x
            Math.abs(Math.round(pos.z)-pos.z) < 0.01? z=Math.round(pos.z) : z=pos.z
            return {x:x,y:pos.y,z:z}
        }
    }else if(constants.overworld.getBlock({x:pos.x,y:pos.y+1,z:pos.z}).typeId !== "minecraft:air"){
        system.runTimeout(()=>{
            player.playSound( Math.random>0.5 ? "damage.fallbig" : "damage.fallsmall" , { location: player.location } );
        },1)
        return {x:pos.x,y:pos.y,z:pos.z}
    }else{
        system.runTimeout(()=>{
            player.playSound( Math.random>0.5 ? "damage.fallbig" : "damage.fallsmall" , { location: player.location } );
        },1)
        return pos
    }
}

/**
 * @param {Player} player 
 */
export function playerFlying(player){
    if(player.bedwarsInfo.canFly!==true)return;
    if(map().gameStage!==1)return;
    let vel = player.getVelocity()
    /**world.sendMessage(`${vel.x}, ${vel.y}, ${vel.z}`)
    world.sendMessage(`${player.inputInfo.getButtonState(InputButton.Jump)}`)*/
    player.inputInfo.getButtonState(InputButton.Jump)==="Pressed"? player.applyImpulse({x:0,y:vel.y<0.3?0.3:0,z:0}) : player.applyImpulse({x:0,y:vel.y>0?-vel.y:0,z:0})
    player.inputInfo.getButtonState(InputButton.Sneak)==="Pressed"? player.applyImpulse({x:0,y:vel.y>-0.3?-0.3:0,z:0}) : null
    player.inputInfo.getButtonState(InputButton.Sneak)==="Released"? player.applyImpulse({x:0,y:vel.y<0?-vel.y:0,z:0}) : null
}

/**
 * @param {beforeChatSendEvent} event 
 */
export function commandEvent(event){
    /**@type {Player}*/
    let player = event.sender;
    /**@type {String}*/
    let srcMesg = event.message
    /**@type {String[]} */
    let mesg = event.message.split( " " );
    const command = mesg[0]
    switch(command){
        case "#makebot":
            if(player.commandPermissionLevel >= 2){
                system.run(() => {
                    constants.overworld.runCommand( "gametest run newTest:test")
                });
                system.runTimeout(() => {
                    newBot(player.location, mesg[1] == undefined|""? 1 : mesg[1]);
                },5)
                event.cancel = true;
            }
            break;
        case "#fly":
            if(player.commandPermissionLevel >= 2||player.bedwarsInfo){
                if( mesg[1] === "true" ){
                    system.run(() => {
                        player.triggerEvent("fly_enabled")
                    });
                    player.bedwarsInfo.canFly = true;
                    GameSystem.Interval( ()=> {
                        return playerFlying(player)
                    },5, { tag: "Interval:playerFlying" } )
                    event.cancel = true;
                }else if(mesg[1] === "false"){
                    system.run(() => {
                        player.triggerEvent("fly_disabled")
                    });
                    player.bedwarsInfo.canFly = false;
                    event.cancel = true;
                }else{
                    player.sendMessage("用法: #fly true/false")
                }
            }
            break;
        case "#reset":
            if(player.commandPermissionLevel >= 2){
                system.run(() => {
                    player.sendMessage("重置状态中...")
                    player.triggerEvent("fly_disabled")
                })
                event.cancel = true;
            }
            break;
        case "#money":
            if(player.commandPermissionLevel >= 2){
                let operation = [ "add", "set", "take" ]
                let moneyType = [ "coin", "diamond", "amethyst", "stardust" ]
                let target = world.getPlayers({name: mesg[1]})[0]
                if( !target ) { player.sendMessage("未找到目标玩家!"); event.cancel = true; return; }
                if( !(mesg[2] && operation.includes(mesg[2])) ){ player.sendMessage("用法: #money <player> <add/set/take> <coin/diamond/amethyst/stardust> <数量>"); event.cancel = true; return;  }
                if( !(mesg[3] && moneyType.includes(mesg[3])) ){ player.sendMessage("用法: #money <player> <add/set/take> <coin/diamond/amethyst/stardust> <数量>"); event.cancel = true; return;  }
                if( !mesg[4] || isNaN(Number(mesg[4])) ){ player.sendMessage("用法: #money <add/set/take> <coin/diamond/amethyst/stardust> <数量>"); event.cancel = true; return; }

                switch(mesg[2]){
                    case "add":
                        system.run(()=>{
                            award( target, mesg[3], Number(mesg[4]) )
                        })
                        break;
                    case "set":
                        system.run( ()=> {
                            set( target, mesg[3], Number(mesg[4]) )
                        })
                        break;
                    case "take":
                        system.run( ()=> {
                            take( target, mesg[3], Number(mesg[4]) )
                        })
                        break;
                }
                event.cancel = true;
            }
            break;
        case "#specialEffect":
            if(player.commandPermissionLevel >= 2){
                let target = world.getPlayers({name: mesg[1]})[0]
                let operation = [ "add", "remove", "clear", "list" ]
                let type = [ "final_kill" ]
                if( !target ) { player.sendMessage("未找到目标玩家!"); event.cancel = true; return; }
                let SE = methods.decodeFromJsonString(target.getDynamicProperty(`special_effect.${mesg[3]}`), { got: [], using: undefined } )
                switch(mesg[2]){
                    case "add":
                        if( !(mesg[2] && operation.includes(mesg[2])) ){ player.sendMessage("用法: #specialEffect <player> <add/remove/clear/list> <SEtype> <SEName>"); event.cancel = true; return;  }
                        if( !(mesg[3] && type.includes(mesg[3])) ){ player.sendMessage("用法: #specialEffect <player> <add/remove/clear/list> <SEtype> <SEName>"); event.cancel = true; return;  }
                        if( SE.got.includes(mesg[4]) ){ player.sendMessage("玩家已拥有该特效!"); event.cancel = true; return; }
                        SE.got.push(mesg[4])
                        target.setDynamicProperty(`special_effect.${mesg[3]}`, methods.encodeToJsonString(SE))
                        player.sendMessage("已添加特效!")
                        break;
                    case "remove":
                        if( !(mesg[2] && operation.includes(mesg[2])) ){ player.sendMessage("用法: #specialEffect <player> <add/remove/clear/list> <SEtype> <SEName>"); event.cancel = true; return;  }
                        if( !(mesg[3] && type.includes(mesg[3])) ){ player.sendMessage("用法: #specialEffect <player> <add/remove/clear/list> <SEtype> <SEName>"); event.cancel = true; return;  }
                        if( !SE.got.includes(mesg[4]) ){ player.sendMessage("玩家没有该特效!"); event.cancel = true; return; }
                        SE.got.splice(SE.got.indexOf(mesg[4]), 1)
                        if( SE.using === mesg[4] ) SE.using = undefined;
                        target.setDynamicProperty(`special_effect.${mesg[3]}`, methods.encodeToJsonString(SE))
                        player.sendMessage("已移除特效!")
                        break;
                    case "clear":
                        if( !(mesg[2] && operation.includes(mesg[2])) ){ player.sendMessage("用法: #specialEffect <player> <add/remove/clear/list> <SEtype> <SEName>"); event.cancel = true; return;  }
                        if( !(mesg[3] && type.includes(mesg[3])) ){ player.sendMessage("用法: #specialEffect <player> <add/remove/clear/list> <SEtype> <SEName>"); event.cancel = true; return;  }
                        SE.got = []
                        SE.using = undefined
                        target.setDynamicProperty(`special_effect.${mesg[3]}`, methods.encodeToJsonString(SE))
                        player.sendMessage("已清空该类型的所有特效!")
                        break;
                    case "list":
                        break;
                }
                event.cancel = true;
            }else{
                methods.showPlayerUI( player, "specialEffect" )
                event.cancel = true;
            }
            break;
    }
    let level = player.getDynamicProperty("level")
    let star = player.getDynamicProperty("star")
    if(map().gameStage == 1){
        if(srcMesg.startsWith("@")||srcMesg.startsWith("!")||srcMesg.startsWith("！")){
            event.cancel = true;
            let bedwarsInfo = player.bedwarsInfo;
            let team = map().teamList.find(t =>{return t.id === bedwarsInfo.team})
            world.sendMessage(`§e[全体]${team.getTeamName("format_code")}<${team.getTeamName("name")}队>§r[${constants.colorForLevels(level)}${level}阶${star}✦]§r<${player.nameTag}§r> ${srcMesg.substring(1)}`)
        }else if(srcMesg.startsWith("#")){
            player.sendMessage("命令已发送!")
        }else{
            event.cancel = true
            let bedwarsInfo = player.bedwarsInfo;
            let team = map().teamList.find(t =>{return t.id === bedwarsInfo.team})
            team.getTeamMember().forEach(p => {
                p.sendMessage(`[队伍]§r[${constants.colorForLevels(level)}${level}阶${star}✦]<${player.nameTag}§r> ${srcMesg}`)
            })
        }
    }else{
        if( !srcMesg.startsWith("#") ){
            event.cancel = true
            world.sendMessage(`§r[${constants.colorForLevels(level)}${level}阶${star}✦]<${player.nameTag}§r> ${srcMesg}`)
        }
    }
}

/**
 * 【循环类】床虱计时器，每只蠹虫最多存活 15 秒，更新其名称
 */
export function bedbugFunction( ) {
    constants.overworld.getEntities( { type: "minecraft:silverfish" } ).filter( silverfish => { return silverfish.killTimer !== undefined } ).forEach( silverfish => {
        silverfish.killTimer++;
        silverfish.nameTag = `§8[§r${silverfish.team.getTeamName( "format_code" )}${silverfish.name()}§8]\n§l${silverfish.team.getTeamName( "name" )}队 §r${silverfish.team.getTeamName( "format_code" )}蠹虫`;
        if ( silverfish.killTimer >= 300 ) { silverfish.kill( ) };
    } )
}

/**
 * 【事件类】玩家使用梦境守护者事件，在使用的位置生成铁傀儡
 * @param {PlayerInteractWithBlockBeforeEvent} event 
 */
export function dreamDefenderEvent(event) {
    const item = event.itemStack
    /**@type {Player} */
    const placer = event.player;
    const block = event.block;
    const face = event.blockFace; // 获取玩家点击的方块面

    if( !event.isFirstEvent ) return;
    if(item?.typeId !== "bedwars:dream_defender") return;
    // 根据点击的方块面计算生成位置
    const offsets = {
        up: { x: 0, y: 1, z: 0 },
        down: { x: 0, y: -1, z: 0 },
        north: { x: 0, y: 0, z: -1 },
        south: { x: 0, y: 0, z: 1 },
        west: { x: -1, y: 0, z: 0 },
        east: { x: 1, y: 0, z: 0 }
    };

    const offset = offsets[face] || { x: 0, y: 1, z: 0 }; // 默认向上生成
    const spawnPosition = {
        x: block.location.x + offset.x,
        y: block.location.y + offset.y,
        z: block.location.z + offset.z
    };

    system.run(()=>{
        // 生成铁傀儡
        const ironGolem = block.dimension.spawnEntity("minecraft:iron_golem", spawnPosition);

        // 清除玩家的梦境守护者物品（非创造模式）
        if (placer.getGameMode() !== GameMode.Creative) {
            placer.runCommand("clear @s bedwars:dream_defender -1 1");
        }

        // 设置铁傀儡的团队归属
        if (methods.playerIsValid(placer)) {
            /** @type {methods.BedwarsPlayer} */
            const placerInfo = placer.bedwarsInfo;
            const teamName = placerInfo.team;

            // 触发团队事件
            ironGolem.triggerEvent(`team_${teamName}`);

            // 设置铁傀儡的团队和名称
            ironGolem.owner = placer
            ironGolem.team = placerInfo.getTeam();
            ironGolem.nameTag = `§8[§r${placerInfo.getTeam().getTeamName("format_code")}§l${placerInfo.getTeam().getTeamName("name")}队§8] §r${placerInfo.getTeam().getTeamName("format_code")}铁傀儡`;

            // 防止铁傀儡攻击同队玩家
            ironGolem.addTag("no_attack_teammates");

            // 设置铁傀儡的自动移除计时器
            system.runTimeout(() => {
                if (ironGolem && ironGolem.isValid) {
                    ironGolem.kill();
                }
            }, 240 * 20); // 240秒后移除
        }
    })
}

/**
 * 
 * @param {PlayerInteractWithBlockBeforeEvent} event 
 */
export function spiderTrapEvent(event){
    const item = event.itemStack
    /**@type {Player} */
    const placer = event.player;
    const block = event.block;
    const face = event.blockFace;

    if( !event.isFirstEvent ) return;
    if( placer.getItemCooldown("spider_trap")>0 ) return; 
    if(item?.typeId !== "bedwars:spider_trap") return;

    // 根据点击的方块面计算生成位置
    const offsets = {
        "Up": { x: 0, y: 1, z: 0 },
        "Down": { x: 0, y: -1, z: 0 },
        "North": { x: 0, y: 0, z: -1 },
        "South": { x: 0, y: 0, z: 1 },
        "West": { x: -1, y: 0, z: 0 },
        "East": { x: 1, y: 0, z: 0 }
    };

    const offset = offsets[face] || { x: 0, y: 1, z: 0 }; // 默认向上生成
    const spawnPosition = {
        x: block.location.x + offset.x,
        y: block.location.y + offset.y,
        z: block.location.z + offset.z
    };

    const allPosiblePositions = [
        { x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z },
        { x: spawnPosition.x + 1, y: spawnPosition.y, z: spawnPosition.z },
        { x: spawnPosition.x - 1, y: spawnPosition.y, z: spawnPosition.z },
        { x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z + 1 },
        { x: spawnPosition.x + 1, y: spawnPosition.y, z: spawnPosition.z + 1 },
        { x: spawnPosition.x - 1, y: spawnPosition.y, z: spawnPosition.z + 1 },
        { x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z - 1 },
        { x: spawnPosition.x + 1, y: spawnPosition.y, z: spawnPosition.z - 1 },
        { x: spawnPosition.x - 1, y: spawnPosition.y, z: spawnPosition.z - 1 },
        { x: spawnPosition.x, y: spawnPosition.y + 1, z: spawnPosition.z },
        { x: spawnPosition.x + 1, y: spawnPosition.y + 1, z: spawnPosition.z },
        { x: spawnPosition.x - 1, y: spawnPosition.y + 1, z: spawnPosition.z },
        { x: spawnPosition.x, y: spawnPosition.y + 1, z: spawnPosition.z + 1 },
        { x: spawnPosition.x + 1, y: spawnPosition.y + 1, z: spawnPosition.z + 1 },
        { x: spawnPosition.x - 1, y: spawnPosition.y + 1, z: spawnPosition.z + 1 },
        { x: spawnPosition.x, y: spawnPosition.y + 1, z: spawnPosition.z - 1 },
        { x: spawnPosition.x + 1, y: spawnPosition.y + 1, z: spawnPosition.z - 1 },
        { x: spawnPosition.x - 1, y: spawnPosition.y + 1, z: spawnPosition.z - 1 },
        { x: spawnPosition.x, y: spawnPosition.y + 2, z: spawnPosition.z },
        { x: spawnPosition.x + 1, y: spawnPosition.y + 2, z: spawnPosition.z },
        { x: spawnPosition.x - 1, y: spawnPosition.y + 2, z: spawnPosition.z },
        { x: spawnPosition.x, y: spawnPosition.y + 2, z: spawnPosition.z + 1 },
        { x: spawnPosition.x + 1, y: spawnPosition.y + 2, z: spawnPosition.z + 1 },
        { x: spawnPosition.x - 1, y: spawnPosition.y + 2, z: spawnPosition.z + 1 },
        { x: spawnPosition.x, y: spawnPosition.y + 2, z: spawnPosition.z - 1 },
        { x: spawnPosition.x + 1, y: spawnPosition.y + 2, z: spawnPosition.z - 1 },
        { x: spawnPosition.x - 1, y: spawnPosition.y + 2, z: spawnPosition.z - 1 }
    ]
    let selectedPos = []
    for(let i = 1; i <= 12; i++){
        let index = methods.randomInt(0, allPosiblePositions.length-1)
        methods.canPlace(allPosiblePositions[index]) ? selectedPos.push(allPosiblePositions[index]) : null
        allPosiblePositions.splice(index,1)
    }
    system.run(()=>{
        selectedPos.forEach(pos => {
            placer.dimension.getBlock(pos)?.typeId === "minecraft:air" ? placer.dimension.setBlockType(pos,"minecraft:web") : null
        })
            if(placer.getComponent("minecraft:inventory").container.getItem(placer.selectedSlotIndex).amount === 1){
                placer.getComponent("minecraft:inventory").container.setItem(placer.selectedSlotIndex,undefined)
            }else{
                let item = placer.getComponent("minecraft:inventory").container.getItem(placer.selectedSlotIndex)
                item.amount--
                placer.getComponent("minecraft:inventory").container.setItem(placer.selectedSlotIndex,item)
            }
        placer.startItemCooldown("spider_trap", 150)
        placer.dimension.playSound("dig.stone", placer.location, { volume: 3 })
    })
}

/** 【事件类】玩家使用防御塔和防御墙事件
 * @param {PlayerPlaceBlockAfterEvent} event
 */
export function towerAndWall( event ){
    if ( event.block.typeId === "minecraft:chest"){
        if ( event.block.location.y >= map().heightLimit.max-8 ) {
            event.dimension.setBlockType( event.block.location, "minecraft:air" )
            event.player.sendMessage( { translate: "§c你不能在这里放置防御塔或防御墙!" } )
            methods.giveItem( event.player, "minecraft:chest", { amount: 1 ,name: "§r防御塔", lore: ["§r§e平地起高楼!"]} )
            return;
        }
        if ( event.player.bedwarsInfo.protectionTower+10000 - Date.now() > 0 ) {
            event.dimension.setBlockType( event.block.location, "minecraft:air" )
            let time = Math.ceil( ( event.player.bedwarsInfo.protectionTower+10000 - Date.now() ) / 1000 )
            event.player.sendMessage( { translate: `§c你还需要等待 ${time} 秒才能放置防御塔!` } )
            methods.giveItem( event.player, "minecraft:chest", { amount: 1 ,name: "§r防御塔", lore: ["§r§e平地起高楼!"]} )
            return;
        }
        event.player.bedwarsInfo.protectionTower = Date.now();
        let view = event.player.getViewDirection()
        let dir;
        let fac;
        // 使用 atan2 计算朝向角并转换为度，范围归一到 [0,360)
        let sita = (Math.atan2(view.z, view.x) * 180 / Math.PI + 360) % 360;
        switch(true){
            case (sita>=45 && sita<135):
                dir = [1,-1]
                fac = 2
                break;
            case (sita>=135 && sita<225):
                dir = [-1,1]
                fac = 5
                break;
            case (sita>=225 && sita<315):
                dir = [-1,-1]
                fac = 1
                break;
            default:
                dir = [1,1]
                fac = 4
                break;
        }
        /**@type {import("@minecraft/server").Vector3}*/ let pos = event.block.location
        /**@type {Dimension}*/ let dim = event.dimension
        let blocks = [
            { x: -2*dir[0], y: 0, z: -1*dir[1] }, { x: -1*dir[0], y: 0, z: -2*dir[1] }, { x: 0, y: 0, z: -2*dir[1] }, { x: 1*dir[0], y: 0, z: -2*dir[1] }, { x: 2*dir[0], y: 0, z: -1*dir[1] }, { x: 2*dir[0], y: 0, z: 0 }, { x: 2*dir[0], y: 0, z: 1*dir[1] }, { x: 1*dir[0], y: 0, z: 2*dir[1] }, { x: 0, y: 0, z: 2*dir[1] }, { x: -1*dir[0], y: 0, z: 2*dir[1] }, { x: -2*dir[0], y: 0, z: 1*dir[1] },
            { x: -2*dir[0], y: 1, z: -1*dir[1] }, { x: -1*dir[0], y: 1, z: -2*dir[1] }, { x: 0, y: 1, z: -2*dir[1] }, { x: 1*dir[0], y: 1, z: -2*dir[1] }, { x: 2*dir[0], y: 1, z: -1*dir[1] }, { x: 2*dir[0], y: 1, z: 0 }, { x: 2*dir[0], y: 1, z: 1*dir[1] }, { x: 1*dir[0], y: 1, z: 2*dir[1] }, { x: 0, y: 1, z: 2*dir[1] }, { x: -1*dir[0], y: 1, z: 2*dir[1] }, { x: -2*dir[0], y: 1, z: 1*dir[1] },
            { x: -2*dir[0], y: 2, z: -1*dir[1] }, { x: -1*dir[0], y: 2, z: -2*dir[1] }, { x: 0, y: 2, z: -2*dir[1] }, { x: 1*dir[0], y: 2, z: -2*dir[1] }, { x: 2*dir[0], y: 2, z: -1*dir[1] }, { x: 2*dir[0], y: 2, z: 0 }, { x: 2*dir[0], y: 2, z: 1*dir[1] }, { x: 1*dir[0], y: 2, z: 2*dir[1] }, { x: 0, y: 2, z: 2*dir[1] }, { x: -1*dir[0], y: 2, z: 2*dir[1] }, { x: -2*dir[0], y: 2, z: 1*dir[1] },{x: -2*dir[0], y: 2, z:0},
            { x: -2*dir[0], y: 3, z: -1*dir[1] }, { x: -1*dir[0], y: 3, z: -2*dir[1] }, { x: 0, y: 3, z: -2*dir[1] }, { x: 1*dir[0], y: 3, z: -2*dir[1] }, { x: 2*dir[0], y: 3, z: -1*dir[1] }, { x: 2*dir[0], y: 3, z: 0 }, { x: 2*dir[0], y: 3, z: 1*dir[1] }, { x: 1*dir[0], y: 3, z: 2*dir[1] }, { x: 0, y: 3, z: 2*dir[1] }, { x: -1*dir[0], y: 3, z: 2*dir[1] }, { x: -2*dir[0], y: 3, z: 1*dir[1] },{x: -2*dir[0], y: 3, z:0},
            { x: -2*dir[0], y: 4, z: -1*dir[1] }, { x: -1*dir[0], y: 4, z: -2*dir[1] }, { x: 0, y: 4, z: -2*dir[1] }, { x: 1*dir[0], y: 4, z: -2*dir[1] }, { x: 2*dir[0], y: 4, z: -1*dir[1] }, { x: 2*dir[0], y: 4, z: 0 }, { x: 2*dir[0], y: 4, z: 1*dir[1] }, { x: 1*dir[0], y: 4, z: 2*dir[1] }, { x: 0, y: 4, z: 2*dir[1] }, { x: -1*dir[0], y: 4, z: 2*dir[1] }, { x: -2*dir[0], y: 4, z: 1*dir[1] },{x: -2*dir[0], y: 4, z:0},
            "fill", { x: -2*dir[0], y: 5, z: -2*dir[1] }, { x: 2*dir[0], y: 5, z: 2*dir[1] },
            { x: -2*dir[0], y: 6, z: -3*dir[1] }, { x: -1*dir[0], y: 6, z: -3*dir[1] }, { x: 0, y: 6, z: -3*dir[1] }, { x: 1*dir[0], y: 6, z: -3*dir[1] }, { x: 2*dir[0], y: 6, z: -3*dir[1] }, { x: 3*dir[0], y: 6, z: -2*dir[1] }, { x: 3*dir[0], y: 6, z: -1*dir[1] }, { x: 3*dir[0], y: 6, z: 0 }, { x: 3*dir[0], y: 6, z: 1*dir[1] }, { x: 3*dir[0], y: 6, z: 2*dir[1] }, { x: 2*dir[0], y: 6, z: 3*dir[1] }, { x: 1*dir[0], y: 6, z: 3*dir[1] }, { x: 0, y: 6, z: 3*dir[1] }, { x: -1*dir[0], y: 6, z: 3*dir[1] }, { x: -2*dir[0], y: 6, z: 3*dir[1] }, { x: -3*dir[0], y: 6, z: 2*dir[1] }, { x: -3*dir[0], y: 6, z: 1*dir[1] }, { x: -3*dir[0], y: 6, z: 0 }, { x: -3*dir[0], y: 6, z: -1*dir[1] }, { x: -3*dir[0], y: 6, z: -2*dir[1] },
            { x: -3*dir[0], y: 7, z: -3*dir[1] }, { x: -1*dir[0], y: 7, z: -3*dir[1] }, { x: 1*dir[0], y: 7, z: -3*dir[1] }, { x: 3*dir[0], y: 7, z: -3*dir[1] }, { x: 3*dir[0], y: 7, z: -1*dir[1] }, { x: 3*dir[0], y: 7, z: 1*dir[1] }, { x: 3*dir[0], y: 7, z: 3*dir[1] }, { x: 1*dir[0], y: 7, z: 3*dir[1] }, { x: -1*dir[0], y: 7, z: 3*dir[1] }, { x: -3*dir[0], y: 7, z: 3*dir[1] }, { x: -3*dir[0], y: 7, z: 1*dir[1] }, { x: -3*dir[0], y: 7, z: -1*dir[1] }
        ]
        let ladder = [
            { x: 1*dir[0], y: 0, z: 0 }, { x: 1*dir[0], y: 1, z: 0 }, { x: 1*dir[0], y: 2, z: 0 }, { x: 1*dir[0], y: 3, z: 0 }, { x: 1*dir[0], y: 4, z: 0 }, { x: 1*dir[0], y: 5, z: 0 }
        ]
        let tick = 0
        dim.setBlockType(pos,"minecraft:air")
        blocks.forEach( (loc,index) => {
            if(loc === "fill"){
                let loc1 = blocks[index+1]
                let loc2 = blocks[index+2]
                if(fac === 1 || fac ===2){
                    let cp1 = methods.copyPosition(loc1)
                    let cp2 = methods.copyPosition(loc2)
                    loc1.x = cp1.z
                    loc1.z = cp1.x
                    loc2.x = cp2.z
                    loc2.z = cp2.x
                }
                loc1 = methods.posPlus(loc1,pos)
                loc2 = methods.posPlus(loc2,pos)
                for(let j =Math.min(loc1.x, loc2.x); j<=Math.max(loc1.x, loc2.x); j++){
                    for(let k = Math.min(loc1.z, loc2.z); k<=Math.max(loc1.z, loc2.z); k++){
                        tick++;
                        system.runTimeout(()=>{
                            ( constants.overworld.getBlock({x:j,y:loc1.y,z:k}).typeId === "minecraft:air" && methods.canPlace({x:j,y:loc1.y,z:k}) ) ? constants.overworld.setBlockType({x:j,y:loc1.y,z:k},`bedwars:${event.player.bedwarsInfo.team}_wool`) : null
                            constants.overworld.playSound("random.pop",{x:j,y:loc1.y,z:k})
                        },Math.floor(tick/3))
                    }
                }
            }else{
                if(fac === 1 || fac ===2){
                    let cp = methods.copyPosition(loc)
                    loc.x = cp.z
                    loc.z = cp.x
                }
                loc = methods.posPlus(loc,pos)
                if(index === blocks.length -1){
                    system.runTimeout(()=>{
                        ( constants.overworld.getBlock(methods.posPlus(ladder[ladder.length - 1],pos)).typeId === `bedwars:${event.player.bedwarsInfo.team}_wool` ) ? constants.overworld.setBlockType(methods.posPlus(ladder[ladder.length - 1],pos),`minecraft:air`) : null
                    },Math.floor(tick/3))
                }
                tick++;
                system.runTimeout(()=>{
                    ( constants.overworld.getBlock(loc).typeId === "minecraft:air" && methods.canPlace(loc) ) ? constants.overworld.setBlockType(loc,`bedwars:${event.player.bedwarsInfo.team}_wool`) : null
                    constants.overworld.playSound("random.pop",loc)
                },Math.floor(tick/3))
            }
        })
        ladder.forEach((loc,index)=>{
            if(fac === 1 || fac ===2){
                let cp = methods.copyPosition(loc)
                loc.x = cp.z
                loc.z = cp.x
            }
            loc = methods.posPlus(loc,pos)
            tick++;
            system.runTimeout(()=>{
                ( methods.canPlace(loc) ) ? constants.overworld.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} ladder ["facing_direction"=${fac}] keep`) : null
                constants.overworld.playSound("random.pop",loc)
            },Math.floor(tick/3))
        })
    }else if ( event.block.typeId === "bedwars:protection_wall" ) {
        if ( event.block.location.y >= map().heightLimit.max-8 ) {
            event.dimension.setBlockType( event.block.location, "minecraft:air" )
            event.player.sendMessage( { translate: "§c你不能在这里放置防御塔或防御墙!" } )
            methods.giveItem( event.player, "bedwars:protection_wall" )
            return;
        }
        if ( event.player.bedwarsInfo.protectionWall+5000 - Date.now() > 0 ) {
            event.dimension.setBlockType( event.block.location, "minecraft:air" )
            let time = Math.ceil( ( event.player.bedwarsInfo.protectionWall+5000 - Date.now() ) / 1000 )
            event.player.sendMessage( { translate: `§c你还需要等待 ${time} 秒才能放置防御塔!` } )
            methods.giveItem( event.player, "bedwars:protection_wall" )
            return;
        }
        event.dimension.setBlockType( event.block.location, "minecraft:air" )
        event.player.bedwarsInfo.protectionWall = Date.now();
        let view = event.player.getViewDirection()
        // 使用 atan2 计算朝向角并转换为度，范围归一到 [0,360)
        let sita = (Math.atan2(view.z, view.x) * 180 / Math.PI + 360) % 360;
        let pos = event.block.location
        switch(true){
            case (sita>=22.5 && sita<67.5):
                methods.fillPlus(methods.posPlus({x:-2,y:0,z:2},pos),methods.posPlus({x:2,y:3,z:-2},pos),`bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay`)
                break;
            case (sita>=67.5 && sita<112.5):
                event.dimension.runCommand(`fill ${pos.x-2} ${pos.y} ${pos.z} ${pos.x+2} ${pos.y+3} ${pos.z} bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay replace air`);
                break;
            case (sita>=112.5 && sita<157.5):
                methods.fillPlus(methods.posPlus({x:-2,y:0,z:-2},pos),methods.posPlus({x:2,y:3,z:2},pos),`bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay`)
                break;
            case (sita>=157.5 && sita<202.5):
                event.dimension.runCommand(`fill ${pos.x} ${pos.y} ${pos.z-2} ${pos.x} ${pos.y+3} ${pos.z+2} bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay replace air`);
                break;
            case (sita>=202.5 && sita<247.5):
                methods.fillPlus(methods.posPlus({x:-2,y:0,z:2},pos),methods.posPlus({x:2,y:3,z:-2},pos),`bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay`)
                break;
            case (sita>=247.5 && sita<292.5):
                event.dimension.runCommand(`fill ${pos.x-2} ${pos.y} ${pos.z} ${pos.x+2} ${pos.y+3} ${pos.z} bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay replace air`);
                break;
            case (sita>=292.5 && sita<337.5):
                methods.fillPlus(methods.posPlus({x:2,y:0,z:2},pos),methods.posPlus({x:-2,y:3,z:-2},pos),`bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay`)
                break;
            default:
                event.dimension.runCommand(`fill ${pos.x} ${pos.y} ${pos.z-2} ${pos.x} ${pos.y+3} ${pos.z+2} bedwars:${event.player.bedwarsInfo.team}_stained_hardened_clay replace air`);
                break;
        }
    }
}

/** 【事件类】玩家使用方块事件，如果使用的方块是位于地图限制的最高或最低位置，则阻止玩家使用
 * @param {PlayerPlaceBlockAfterEvent} event
 */
export function playerUseItemOnHeightLimitEvent( event ) {

    const player = event.player;
    const location = event.block.location;
    const typeId = event.block.typeId;

    if ( typeId === "minecraft:chest" ) {
        if ( location.y >= map().heightLimit.max-8 ) {
            event.dimension.setBlockType( event.block.location, "minecraft:air" )
            player.sendMessage( { translate: "§c你不能在这里放置防御塔!" } )
            methods.giveItem( event.player, "minecraft:chest", { amount: 1 ,name: "§r防御塔", lore: ["§r§e平地起高楼!"]} )
            return false;
        }
    }else if ( typeId === "bedwars:protection_wall" ) {
        if ( location.y >= map().heightLimit.max-5 ) {
            event.dimension.setBlockType( event.block.location, "minecraft:air" )
            player.sendMessage( { translate: "§c你不能在这里放置防御墙!" } )
            methods.giveItem( event.player, "bedwars:protection_wall" )
            return false;
        }
    }

    if ( methods.canPlace( location, typeId ) === false ) {
        player.addItem( event.block.permutation.getItemStack(1) )
        event.dimension.setBlockType( event.block.location, "minecraft:air" )
        player.sendMessage( { translate: "§c你不能在这里放置方块！" } )
        return false;
    }

    return true;
}

/**
 * 【循环类】梦境守护者计时器，每只铁傀儡最多存活 240 秒，更新其名称
 */
export function dreamDefenderFunction( ) {
    constants.overworld.getEntities( { type: "minecraft:iron_golem" } ).filter( ironGolem => { return ironGolem.killTimer !== undefined } ).forEach( ironGolem => {
        ironGolem.killTimer++;
        ironGolem.nameTag = `§8[§r${ironGolem.team.getTeamName( "format_code" )}${ironGolem.name()}§8]\n§l${ironGolem.team.getTeamName( "name" )}队 §r${ironGolem.team.getTeamName( "format_code" )}铁傀儡`;
        if ( ironGolem.killTimer >= 4800 ) { ironGolem.kill( ) };
    } )
}

/**
 * 【循环类】搭桥蛋功能，经过之处生成掷出者队伍的羊毛；范围3*3，完整度85%
 */
export function bridgeEggFunction( bridgeEgg ) {
    if(bridgeEgg.isValid === false) return true;
    /** @type {Entity} */ let owner = bridgeEgg.getComponent( "minecraft:projectile" ).owner;
        if ( methods.playerIsValid( owner ) ) {
            /** @type {methods.BedwarsPlayer} */ let ownerInfo = owner.bedwarsInfo;
            for (let x = -1; x <= 1; x++) {
                for (let z = -1; z <= 1; z++) {
                    if ( Math.random() < 0.85 && constants.overworld.getBlock( methods.posPlus( { x: x, y: -2, z: z }, bridgeEgg.location ) ).typeId === "minecraft:air" && methods.canPlace( methods.posPlus( { x: x, y: -2, z: z }, bridgeEgg.location ) ) ) {
                        constants.overworld.setBlockType( methods.posPlus( { x: x, y: -2, z: z }, bridgeEgg.location ), `bedwars:${ownerInfo.team}_wool` )
                        methods.eachPlayer( player => {
                            bridgeEgg.isValid? player.playSound( "random.pop", { location: bridgeEgg.location } ) : null
                        } )
                    }    
                } 
            }
        }else{
            return true;
        }
}

/**
 * 【事件类】玩家放下TNT事件
 * @param {PlayerPlaceBlockAfterEvent} event 
 */
export function playerUseTNTEvent( event ) {
    if ( event.block.typeId === "bedwars:tnt" && methods.canPlace( event.block.location ) ) {
        let x = event.block.location.x; let y = event.block.location.y; let z = event.block.location.z; 
        event.dimension.setBlockType( event.block.location, "minecraft:air" )
        let tnt = event.dimension.spawnEntity( "minecraft:tnt", {x:x+0.5,y:y,z:z+0.5})
        tnt.setDynamicProperty( "owner", event.player.nameTag )
    }
}

/**
 * 【事件类】玩家放下水桶事件
 * @param {ItemUseAfterEvent} event 
 */
export function playerUseWaterBucketEvent( event ) {
    if ( event.itemStack.typeId === "minecraft:water_bucket" ) {
        event.source.runCommand( `clear @s bucket` );
    }
}

/**
 * 【事件类】玩家使用搭桥蛋后事件
 * @param {ItemUseAfterEvent} event 
 */
export function playerUseBridgeEggEvent( event ) {
    if ( event.itemStack.typeId === "bedwars:bridge_egg" ) {
        let egg = constants.overworld.getEntities({location: event.source.location ,maxDistance:3,type:"bedwars:bridge_egg"}).filter( entity => { return entity.getComponent("minecraft:projectile")?.owner?.nameTag === event.source.nameTag } )[0]
        GameSystem.Interval( ()=> {
            return bridgeEggFunction( egg )
        },1, { tag: "Interval:bridgeEggFunction" } )
    }
}

/**
 * 玩家装备检测与补充，包括剑斧附魔检测、盔甲存在与附魔检测、剑镐斧剪刀供应
 */
export function equipmentFunction( event ) {
    let player = event.player
    if ( methods.playerIsAlive( player ) ) {

        /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;

        /** 剑镐斧剪刀供应器 */
        playerInfo.swordSupplier()
        playerInfo.axeSupplier()
        playerInfo.pickaxeSupplier()
        playerInfo.shearsSupplier()

        /** 剑、斧附魔检测器 */
        if ( playerInfo.getTeam( ).teamUpgrade.sharpenedSwords >0 ) {
            [ "wooden", "stone", "iron", "diamond" ].forEach( tier => { [ "sword", "axe" ].forEach( type => { player.runCommand( `/enchant @s[hasitem={item=bedwars:${tier}_${type},location=slot.weapon.mainhand}] sharpness ${playerInfo.getTeam( ).teamUpgrade.sharpenedSwords}` ) } ) } )
            player.runCommand( `/enchant @s[hasitem={item=bedwars:netherite_sword,location=slot.weapon.mainhand}] sharpness ${playerInfo.getTeam( ).teamUpgrade.sharpenedSwords}`)
            player.runCommand( `/enchant @s[hasitem={item=bedwars:seven_deadly_sins,location=slot.weapon.mainhand}] sharpness ${playerInfo.getTeam( ).teamUpgrade.sharpenedSwords}`)
        }
        
        /** 盔甲检测器 */
        let playerEquipment = player.getComponent( "minecraft:equippable" );
        let enchantmentLevel = playerInfo.getTeam( ).teamUpgrade.reinforcedArmor
        let featherFallingLevel = playerInfo.getTeam( ).teamUpgrade.featherFalling
        let equipmentType = ( ) => { switch ( playerInfo.equipment.armor ) { case 2: return "chainmail"; case 3: return "iron"; case 4: return "diamond"; case 5: return "netherite"; default: return `${playerInfo.team}`; } }
        if ( playerEquipment.getEquipment( "Head" ) === undefined || methods.getEnchantmentLevel( player, "Head", "protection" ) !== enchantmentLevel ) {
            methods.replaceEquipmentItem( player, `bedwars:${playerInfo.team}_helmet`, "Head", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel } ] } )
        }
        if ( playerEquipment.getEquipment( "Chest" ) === undefined || methods.getEnchantmentLevel( player, "Chest", "protection" ) !== enchantmentLevel ) {
            methods.replaceEquipmentItem( player, `bedwars:${playerInfo.team}_chestplate`, "Chest", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel } ] } )
        }
        if ( playerEquipment.getEquipment( "Legs" ) === undefined || methods.getEnchantmentLevel( player, "Legs", "protection" ) !== enchantmentLevel || playerEquipment.getEquipment( "Legs" ).typeId !== `bedwars:${equipmentType()}_leggings` ) {
            methods.replaceEquipmentItem( player, `bedwars:${equipmentType()}_leggings`, "Legs", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel } ] } )
        }
        if ( playerEquipment.getEquipment( "Feet" ) === undefined || methods.getEnchantmentLevel( player, "Feet", "protection" ) !== enchantmentLevel || playerEquipment.getEquipment( "Feet" ).typeId !== `bedwars:${equipmentType()}_boots` ) {
            methods.replaceEquipmentItem( player, `bedwars:${equipmentType()}_boots`, "Feet", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel }, { id: "feather_falling", level: featherFallingLevel } ] } )
        }
    }
}

/**
 * 装备更新
 * @param {GameEvent} event 
 */
export function upgradeEquipment( event ){
    let players;
    event.player === undefined ? players = event.team.getAliveTeamMember() : players = [event.player]
    players.forEach( (player) => {
        if ( methods.playerIsAlive( player ) ) {

            /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
            
            /** 盔甲检测器 */
            let playerEquipment = player.getComponent( "minecraft:equippable" );
            let enchantmentLevel = playerInfo.getTeam( ).teamUpgrade.reinforcedArmor
            let featherFallingLevel = playerInfo.getTeam( ).teamUpgrade.featherFalling
            let equipmentType = ( ) => { switch ( playerInfo.equipment.armor ) { case 2: return "chainmail"; case 3: return "iron"; case 4: return "diamond"; case 5: return "netherite"; default: return `${playerInfo.team}`; } }
            if ( playerEquipment.getEquipment( "Head" ) === undefined || methods.getEnchantmentLevel( player, "Head", "protection" ) !== enchantmentLevel ) {
                methods.replaceEquipmentItem( player, `bedwars:${playerInfo.team}_helmet`, "Head", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel } ] } )
            }
            if ( playerEquipment.getEquipment( "Chest" ) === undefined || methods.getEnchantmentLevel( player, "Chest", "protection" ) !== enchantmentLevel ) {
                methods.replaceEquipmentItem( player, `bedwars:${playerInfo.team}_chestplate`, "Chest", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel } ] } )
            }
            if ( playerEquipment.getEquipment( "Legs" ) === undefined || methods.getEnchantmentLevel( player, "Legs", "protection" ) !== enchantmentLevel || playerEquipment.getEquipment( "Legs" ).typeId !== `bedwars:${equipmentType()}_leggings` ) {
                methods.replaceEquipmentItem( player, `bedwars:${equipmentType()}_leggings`, "Legs", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel } ] } )
            }
            if ( playerEquipment.getEquipment( "Feet" ) === undefined || methods.getEnchantmentLevel( player, "Feet", "protection" ) !== enchantmentLevel || methods.getEnchantmentLevel( player, "Feet", "feather_falling" ) !== featherFallingLevel || playerEquipment.getEquipment( "Feet" ).typeId !== `bedwars:${equipmentType()}_boots` ) {
                methods.replaceEquipmentItem( player, `bedwars:${equipmentType()}_boots`, "Feet", { itemLock: "slot", enchantments: [ { id: "protection", level: enchantmentLevel }, { id: "feather_falling", level: featherFallingLevel } ] } )
            }
        }
    })
}

/**
 * 武器更新
 * @param {GameEvent} event 
 */
export function upgradeWeapon( event ){
    let players;
    event.player === undefined ? players = event.team.getAliveTeamMember() : players = [event.player]
    players.forEach( (player) => {
        if ( methods.playerIsAlive( player ) ) {

            /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;

            /** 剑、斧附魔检测器 */
            if ( playerInfo.getTeam( ).teamUpgrade.sharpenedSwords >0 ) {
                [ "wooden", "stone", "iron", "diamond" ].forEach( tier => { [ "sword", "axe" ].forEach( type => { player.runCommand( `/enchant @s[hasitem={item=bedwars:${tier}_${type},location=slot.weapon.mainhand}] sharpness ${playerInfo.getTeam( ).teamUpgrade.sharpenedSwords}` ) } ) } )
                player.runCommand( `/enchant @s[hasitem={item=bedwars:netherite_sword,location=slot.weapon.mainhand}] sharpness ${playerInfo.getTeam( ).teamUpgrade.sharpenedSwords}`)
                player.runCommand( `/enchant @s[hasitem={item=bedwars:seven_deadly_sins,location=slot.weapon.mainhand}] sharpness ${playerInfo.getTeam( ).teamUpgrade.sharpenedSwords}`)
            }
        }
    })
}

/**
 * 工具更新
 * @param {GameEvent} event 
 */
export function upgradeTool( event ){
    let player = event.player
    if ( methods.playerIsAlive( player ) ) {

        /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;

        /** 镐斧剪刀供应器 */
        playerInfo.axeSupplier()
        playerInfo.pickaxeSupplier()
        playerInfo.shearsSupplier()
    }
}

/**
 * 【事件类】爆炸物事件，包括：防止爆炸破坏特定方块；对无法从爆炸中生成掉落物的自定义方块，手动生成掉落物；火球跳功能
 * @param {ExplosionBeforeEvent} event
 */
export function explosionEvents( event ) {

    /** 将爆炸破坏的方块设置为非原版方块，或属于在 constants.breakableVanillaBlocksByExplosion 数组中的可破坏方块 */
    event.setImpactedBlocks( event.getImpactedBlocks( ).filter( block => { return constants.breakableVanillaBlocksByExplosion.includes( block.typeId ) || !block.typeId.includes( "minecraft:" ) }) );
    event.setImpactedBlocks( event.getImpactedBlocks( ).filter( block => { return !block.typeId.includes("glass") } ) );

    /** 在可破坏的方块列表中，如果有属于 constants.dropsFromExplosion 的方块，则在方块位置生成掉落物 */
    let blockList = [];
    event.getImpactedBlocks().filter( block => { if ( world.gameRules.tntExplosionDropDecay === false && event.source.typeId === "minecraft:tnt" ) { return constants.dropsFromExplosion.includes( block.typeId ) } else { return constants.dropsFromExplosion.includes( block.typeId ) && Math.random() < 0.33 } } ).forEach( block => { blockList.push( { id: block.typeId, pos: block.location } ) } );
    system.run( () => { blockList.forEach( block => { methods.spawnItem( block.pos, block.id, { clearVelocity: false } ); } ); } )

    let source = event.source
    if(!event.source?.location)return;
    let pos = event.source.location
    let players = methods.getPlayerNearby(pos, 3)
    switch( source.typeId ){
        case "minecraft:wind_charge_projectile":
        system.run( () => {
            if(players.length !== 0){
                players.forEach( player => {
                    let leng = Math.sqrt((player.location.x-pos.x)*(player.location.x-pos.x)+(player.location.z-pos.z)*(player.location.z-pos.z))
                    let power
                    if(leng>=1.5){
                        power = 4.5/leng
                    }else{
                        power = 6
                    }
                    let k = power/leng
                    const knockback = {
                        x:(player.location.x-pos.x)*k,
                        z:(player.location.z-pos.z)*k
                    }
                    if( leng < 0.25 ) {
                        knockback.x = 0;
                        knockback.z = 0;
                    }
                    player.applyKnockback({x: knockback.x, z: knockback.z}, power/6)
                    player.bedwarsInfo.affordDamage.fall = 3
                })
            }
        })
        break;
        case "bedwars:fireball":
        system.run( () => {
            if(players.length !== 0){
                players.forEach( player => {
                    let leng = Math.sqrt((player.location.x-pos.x)*(player.location.x-pos.x)+(player.location.z-pos.z)*(player.location.z-pos.z))
                    let power
                    if(leng>=1){
                        power = 2.4/leng
                    }else{
                        power = 2.4
                    }
                    let k = power/leng
                    const knockback = {
                        x:(player.location.x-pos.x)*k,
                        z:(player.location.z-pos.z)*k
                    }
                    if( leng < 0.5 ) {
                        knockback.x = 0;
                        knockback.z = 0;
                    }
                    player.applyKnockback({x: knockback.x, z: knockback.z}, power/3)
                    player.applyDamage( 1 )
                    //player.playSound("game.player.hurt",{location:player.location,volume:1.5,pitch:1})
                })
            }
        })
        event.setImpactedBlocks( event.getImpactedBlocks( ).filter( block => { 
            return !block.typeId.includes( "minecraft:" ) || constants.breakableVanillaBlocksByExplosion.includes( block.typeId ) 
        } ) );
        event.setImpactedBlocks( event.getImpactedBlocks( ).filter( block => {
            return !constants.canNotbreakByFireball.includes( block.typeId ) 
        }))
        event.setImpactedBlocks( event.getImpactedBlocks( ).filter( block => { return !block.typeId.includes("glass") } ) );
        break;    
    }
}

/**
 * 【循环类】爆炸物功能，对火球和TNT附近的玩家施加抗性提升的效果，以求高破坏低伤害
 */
export function explosionFunction( exp ) {
    if( !exp ) return true;
    if( exp.isValid === false) return true;
    switch (exp.typeId) {
        case "bedwars:fireball":
            let playerNearFireball = methods.getPlayerNearby( exp.location, 2 );
            if ( playerNearFireball.length !== 0 ) { playerNearFireball.forEach( player => { player.addEffect( "resistance", 2, { showParticles: false, amplifier: 3 } ) } ) }
        case "minecraft:tnt": 
            let playerNeartnt = methods.getPlayerNearby( exp.location, 5 );
            if ( playerNeartnt.length !== 0 ) { playerNeartnt.forEach( player => { player.addEffect( "resistance", 2, { showParticles: false, amplifier: 3 } ) } ) } 
    }
}

/**
 * 【循环类】药效功能，包括饱和、疯狂矿工（急迫）、治愈池（生命恢复），每秒执行 1 次
 */
export function effectFunction( ) {

        /** 全局：饱和效果 */
        methods.eachPlayer( player => { player.addEffect( "saturation", 1, { amplifier: 9, showParticles: false } ); } )

        /** 团队升级 */
        if ( map().gameStage === 1 ) { methods.eachTeam( team => { team.teamUpgradeEffect( ) } ); };

        /** 随机事件 */
        if( map().gameStage === 1 && map().randomEventInfo.id == "swift_duel" && map().randomEventInfo.triggered === true ) {
            methods.eachPlayer( player => { 
                player.addEffect( "haste", 20, { amplifier: 1, showParticles: false } ) 
                player.addEffect( "strength", 20, { amplifier: 0, showParticles: false } )
                player.addEffect( "speed", 20, { amplifier: 1, showParticles: false } )
                player.addEffect( "jump_boost", 20, { amplifier: 4, showParticles: false } )
            } )
        }
}

/**
 * 【循环类】陷阱功能，包括陷阱的触发、陷阱的提示
 */
export function trapFunction( team ) {
    /** 陷阱运行 */
    
        /** ===== 队伍的陷阱冷却控制 ===== */
        if ( team.trapInfo.cooldownEnabled === true ) {
            team.trapInfo.cooldown--;
            if ( team.trapInfo.cooldown <= 0 ) { team.trapInfo.cooldownEnabled = false; team.trapInfo.cooldown = 600; }
        };
    
        /** ===== 陷阱触发 ===== */
    
        /** 获取入侵的敌人信息 */
        let getEnemy = () => {
            /** 获取床 10 格范围内所有玩家 */
            let playersNearBed = methods.getPlayerNearby( team.bedInfo.pos, 10 );
            /** 不是无玩家的情况 */
            if ( playersNearBed.length !== 0 ) {
                let enemies = playersNearBed.filter( player => {
                    /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo
                    return methods.playerIsAlive( player ) /** 不是无效玩家且不是已死亡的玩家 */
                    && playerInfo.team !== team.id /** 不是本队玩家 */
                    && playerInfo.magicMilk.enabled !== true /** 不是喝了魔法牛奶的玩家 */
                } )
                if ( enemies.length !== 0 ) { return enemies[0] }
            }
        }
    
        let enemy = getEnemy();
        /** 当：1. 该队伍的一号位存在陷阱；2. 该队伍的陷阱不处于冷却状态； 3. 存在未喝魔法牛奶的未死亡合法敌人，
         *  则：触发陷阱
         */
        if ( team.teamUpgrade.trap1Type !== "" && team.trapInfo.cooldownEnabled === false && enemy !== undefined ) {
            team.triggerTrap( enemy )
        }
    
        /** ===== 警报陷阱 ===== */
        if ( team.trapInfo.isAlarming === true && system.currentTick % 2 === 0 ) {
            /** 对特定位置的特定玩家加以1.5和1.7交叉音调的警报音效
             * @param {Player} player 警报玩家
             * @param {import("@minecraft/server").Vector3} pos 警报位置
             */
            let alarmSound = ( player, pos ) => {
                player.playSound( "note.pling", { pitch: 1.5 + 0.2 * ( team.trapInfo.alarmedTimes % 2 ), location: pos } ) /** 给床附近的人以警告 */
            }
            /** 对床边的所有玩家（包括敌人）和本队所有玩家（无论在何处）加以警报 */
            methods.eachPlayer( player => { alarmSound( player, team.bedInfo.pos ) } )
            team.getTeamMember().forEach( player => { alarmSound( player, player.location ) } )
            /** 记录警报次数，警报超过56次则关闭警报 */
            team.trapInfo.alarmedTimes++;
            if ( team.trapInfo.alarmedTimes >= 56 ) {
                team.trapInfo.isAlarming = false;
                team.trapInfo.alarmedTimes = 0;
            }
        };

}

/**
 * 【循环类】资源生成功能，分队伍资源生成与世界资源生成，以及玩家位置检测（以调整上限）
 */
export function spawnResourceFunction( ) {
    if(map().gameStage !== 1) return true;
    
    /** 各队伍的资源生成 | 铁锭、金锭、绿宝石 | 受设置“允许无效队伍产生资源”的影响 */
    methods.eachTeam( team => { if ( methods.settings.invalidTeamCouldSpawnResources === true || ( methods.settings.invalidTeamCouldSpawnResources === false && team.isValid === true ) ) {
        if ( team.spawnerInfo.ironCountdown <= 0 ) {
            for ( let i = 0; i < map().spawnerInfo.ironSpawnTimes; i++ ) { team.spawnResources( "iron" ); }
            team.spawnerInfo.ironCountdown = Math.floor( map().spawnerInfo.ironInterval * map().spawnerInfo.ironSpawnTimes / team.getForgeBonus() );
        };
        if ( team.spawnerInfo.goldCountdown <= 0 ) {
            team.spawnResources( "gold" );
            team.spawnerInfo.goldCountdown = Math.floor( map().spawnerInfo.goldInterval / team.getForgeBonus() );
        };
        if ( team.spawnerInfo.emeraldCountdown <= 0 ) {
            team.spawnResources( "emerald" );
            team.spawnerInfo.emeraldCountdown = map().spawnerInfo.emeraldInterval;
        }
        team.spawnerInfo.ironCountdown-=5;
        team.spawnerInfo.goldCountdown-=5;
        team.spawnerInfo.emeraldCountdown-=5;
        /** 检测玩家在资源点附近时，则清除使用次数 */
        if ( methods.getPlayerNearby( team.spawnerInfo.spawnerPos, 2.5 ).filter( player => methods.playerIsAlive(player) ).length !== 0 ) {
            team.resetSpawnerSpawnedTimes();
        };
    } } )

    /** 世界资源生成 | 钻石点、绿宝石点 */
    if ( map().spawnerInfo.diamondCountdown <= 0 ) {
        map().spawnResources( "diamond" );
        map().spawnerInfo.diamondCountdown = map().spawnerInfo.diamondInterval - 4 * 20 * map().spawnerInfo.diamondLevel ;
    };
    if ( map().spawnerInfo.emeraldCountdown <= 0 ) {
        map().spawnResources( "emerald" );
        map().spawnerInfo.emeraldCountdown = map().spawnerInfo.emeraldInterval - 5 * 20 * map().spawnerInfo.emeraldLevel ;
    };
    map().spawnerInfo.diamondCountdown-=5;
    map().spawnerInfo.emeraldCountdown-=5;

    /** 显示资源点动画和生成信息 */
    map().showTextAndAnimation( );

    /** 检测玩家在资源点附近时，则清除使用次数 */
    map().spawnerInfo.diamondInfo.forEach( spawner => {
        if ( methods.getPlayerNearby( spawner.pos, 2.5 ).length !== 0 ) { map().resetSpawnerSpawnedTimes( spawner.pos ); };
    } );
    map().spawnerInfo.emeraldInfo.forEach( spawner => {
        if ( methods.getPlayerNearby( spawner.pos, 2.5 ).length !== 0 ) { map().resetSpawnerSpawnedTimes( spawner.pos ); };
    } );

}

/**
 * 
 * @param {PlayerInteractWithEntityAfterEvent} event 
 * @returns 
 */
export function afterInteractWithTraderEvent( event ) {
    let tar = event.target;
    let traderSkin = methods.decodeFromJsonString(event.player.getDynamicProperty( "special_effect.trader_skin" ))
    if(tar.typeId !== "bedwars:trader")return;
    tar.nameTag = ""
    tar.addEffect("invisibility",20000000,{showParticles:false})
    map().resetTrader(tar.getDynamicProperty( "trader_number" ) , traderSkin?.using )
    tar.teleport({x:tar.location.x,y:tar.location.y-2,z:tar.location.z})
    tar.addTag(`using`)
    tar.addTag(`${event.player.name}`)
    if(!event.player.bedwarsInfo.trader){
        event.player.bedwarsInfo.trader = tar;
        event.player.bedwarsInfo.tradeView = event.player.getViewDirection();
    }else{
        event.player.bedwarsInfo.trader.isValid? event.player.bedwarsInfo.trader.remove() : null
        event.player.bedwarsInfo.trader = tar
        event.player.bedwarsInfo.tradeView = event.player.getViewDirection();
    }
    GameSystem.Interval( ()=> {
        return tradeFunction(event.player, tar);
    },1, { tag: "Interval:tradeFunction" })
}

/**
 * 
 * @param {PlayerInteractWithEntityBeforeEvent} event 
 * @returns 
 */
export function beforeInteractWithTraderEvent( event ){
    if(event.target.typeId !== "bedwars:trader")return;
    if(event.target.getTags().includes(`using`)){
        event.cancel = true;
    }
}

/**
 * 
 * @param {EntityItemDropAfterEvent} event 
 */
export function avoidDropShopitem( event ){
    /**@type {Entity[]} */
    let items = event.items
    /**@type {Entity} */
    let player = event.entity

    if(player.typeId !== "minecraft:player") return;
    items.forEach( item =>{
        if(item.getComponent( "minecraft:item" ).itemStack.typeId.includes( "bedwars:shopitem_" ) || 
            item.getComponent( "minecraft:item" ).itemStack.typeId.includes( "bedwars:upgrade_" ) || 
            item.getComponent( "minecraft:item" ).itemStack.typeId.includes( "bedwars:category_" ) || 
            item.getComponent( "minecraft:item" ).itemStack.nameTag?.includes( "§a" ) || 
            item.getComponent( "minecraft:item" ).itemStack.typeId == ( "bedwars:divider" ) || 
            item.getComponent( "minecraft:item" ).itemStack.typeId == ( "bedwars:selected_divider" ) ||
            item.getComponent( "minecraft:item" ).itemStack.typeId == ( "bedwars:prohibited" ) )
        {
            item.remove()
        }
    })
}

/**
 * @param {EntityContainerClosedAfterEvent} event 
 * 取消交易事件
 */
export function cancelTrading( event ){
    if( event.entity.typeId === "bedwars:trader" && event.closeSource.entity.typeId === "minecraft:player" ){
        if (event.entity.isValid) event.entity.remove()
    }
}

/**
 * 【循环类】交易功能，控制玩家在商人附近锁定物品、交易功能、清除商店物品掉落物
 *  @param {Player} player - 玩家对象
 *  @param {Entity} trader - 商人对象
 */
export function tradeFunction( player, trader ) {
    /** 当玩家在商人3格以内时，并且商人在玩家视角之中时，设置其所有物品为itemLock的，以防止玩家将物品放进商人背包之中 */
    let alwaysLockInInventory = [ "bedwars:wooden_sword", "bedwars:wooden_pickaxe", "bedwars:iron_pickaxe", "bedwars:golden_pickaxe", "bedwars:diamond_pickaxe", "bedwars:wooden_axe", "bedwars:stone_axe", "bedwars:iron_axe", "bedwars:diamond_axe", "bedwars:shears" ]
    if ( !trader?.isValid || !player?.isValid ) {
        /** @type {Container} */ let playerInventory = player.getComponent( "minecraft:inventory" ).container
        for ( let i = 0; i < playerInventory.size; i++ ) {
            if ( playerInventory.getItem(i) !== undefined && playerInventory.getSlot(i).lockMode === "inventory" && !alwaysLockInInventory.includes(playerInventory.getSlot(i).typeId) ) {
                playerInventory.getSlot(i).lockMode = "none"
            }
        }
        const cursorInv = player.getComponent("minecraft:cursor_inventory");
        if (cursorInv?.item !== undefined) {
            cursorInv.item.lockMode = "none";
        }
        if (trader?.isValid) trader.remove()
        player.bedwarsInfo.trader = undefined
        return true;
    }
    if ( methods.isWithinDistance( player.location, trader.location, 3.5 ) ) {
            /** @type {Container} */ let playerInventory = player.getComponent( "minecraft:inventory" ).container
            for ( let i = 0; i < playerInventory.size; i++ ) {
                if ( playerInventory.getItem(i) !== undefined && playerInventory.getSlot(i).lockMode === "none" && !alwaysLockInInventory.includes(playerInventory.getSlot(i).typeId) ) {
                    playerInventory.getSlot(i).lockMode = "inventory"
                }
            }
            if(player.clientSystemInfo.platformType === PlatformType.Desktop && player.getComponent("minecraft:cursor_inventory").item){
                if(player.getComponent("minecraft:cursor_inventory").item.typeId.includes("bedwars:shopitem_") || player.getComponent("minecraft:cursor_inventory").item.typeId === "minecraft:trapped_chest"){
                    /** 玩家购买物品 */
                    let category_item = categories[player.bedwarsInfo.category[0]]
                    if ( trader.getComponent("minecraft:type_family").hasTypeFamily("item_trader")) {
                        /**for(let i = 1; i < category_item.length; i++){
                            if (player.getComponent("minecraft:cursor_inventory").item?.typeId === category_item[i].shopitemId){
                                player.getComponent("minecraft:cursor_inventory").clear()
                                category_item[i].playerPurchaseItems( player )
                            }
                        }*/
                        let copy = category_item.slice()
                        copy = copy.filter( item => { return item.shopitemId === player.getComponent("minecraft:cursor_inventory").item?.typeId})
                        player.getComponent("minecraft:cursor_inventory").clear()
                        copy[0].playerPurchaseItems( player )
                    }
                    // 如果附近存在 team_upgrade_trader，则也检测团队升级的购买交互
                }else if(player.getComponent("minecraft:cursor_inventory").item?.typeId.includes("bedwars:upgrade_")){
                    let category_team = teamUpgradeShopitems[player.bedwarsInfo.category[1]]
                    if ( trader.getComponent("minecraft:type_family").hasTypeFamily("team_upgrade_trader")) {
                        /**for(let i = 1; i < category_team.length; i++){
                            if (player.getComponent("minecraft:cursor_inventory").item?.typeId === category_team[i].shopitemId){
                                player.getComponent("minecraft:cursor_inventory").clear()
                                category_team[i].playerPurchaseItems( player )
                            }
                        }*/
                        let copy = category_team.slice()
                        copy = copy.filter( item => { return item.shopitemId === player.getComponent("minecraft:cursor_inventory").item?.typeId})
                        player.getComponent("minecraft:cursor_inventory").clear()
                        copy[0].playerPurchaseItems( player )
                    }
                }else if(player.getComponent("minecraft:cursor_inventory").item?.typeId.includes("bedwars:category_")){
                    methods.categoryClick( player )
                }
            }
            if(trader.getComponent("minecraft:type_family").hasTypeFamily("item_trader")){
                methods.setTraderItemPlus_item(trader);
            }else if(trader.getComponent("minecraft:type_family").hasTypeFamily("team_upgrade_trader")){
                methods.setTraderItemPlus_team(trader);
            }
            methods.clearDivider( player )
    } else {
        /** @type {Container} */ let playerInventory = player.getComponent( "minecraft:inventory" ).container
        for ( let i = 0; i < playerInventory.size; i++ ) {
            if ( playerInventory.getItem(i) !== undefined && playerInventory.getSlot(i).lockMode === "inventory" && !alwaysLockInInventory.includes(playerInventory.getSlot(i).typeId) ) {
                playerInventory.getSlot(i).lockMode = "none"
            }
        }
        const cursorInv = player.getComponent("minecraft:cursor_inventory");
        if (cursorInv?.item !== undefined) {
            cursorInv.item.lockMode = "none";
        }
        if (trader?.isValid) trader.remove()
        player.bedwarsInfo.trader = undefined
        return true;
    }
}

/**
 * @param {PlayerInteractWithBlockBeforeEvent} event 
 */
export function avoidInteractWithBed( event ){
    if( event.block.typeId !== "minecraft:bed" ) return;
    if( event.player.isSneaking && event.itemStack ) return;
    event.cancel=true
}


/**
 * @param {Player} player
 * 【循环类】重生功能，包括玩家重生点设定和玩家死亡重生时的事件
 */
export function respawnFunction( player ) {
        /** 玩家重生点设定 */
        player.setSpawnPoint( { ...map().spawnpointPos, ...{ dimension: constants.overworld } } )
        let cancel = false

        /** 玩家死亡时事件 */
        if ( player.bedwarsInfo.deathState.isDeath ) {

            /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
    
            /** 对可重生玩家 */
            if ( playerInfo.deathState.respawnCountdown === 100 ){
                player.setGameMode( GameMode.Spectator )
                methods.showTitle( player, "§c你死了！", `§e你将在§c${methods.tickToSecond(playerInfo.deathState.respawnCountdown)}§e秒后重生！`, { fadeInDuration: 0 } )
                player.sendMessage( { translate: "message.respawning", with: [ `${methods.tickToSecond(playerInfo.deathState.respawnCountdown)}` ] } );
                playerInfo.deathState.respawnCountdown-=20;
            }else if ( playerInfo.deathState.respawnCountdown > 0 ) {
                player.setGameMode( GameMode.Spectator )
                methods.showTitle( player, "§c你死了！", `§e你将在§c${methods.tickToSecond(playerInfo.deathState.respawnCountdown)}§e秒后重生！`, { fadeInDuration: 0 } )
                player.sendMessage( { translate: "message.respawning", with: [ `${methods.tickToSecond(playerInfo.deathState.respawnCountdown)}` ] } );
                playerInfo.deathState.respawnCountdown-=20;
            }
            /** 重生倒计时结束后，重生玩家 */
            else if ( playerInfo.deathState.respawnCountdown <= 0 ) {
                playerInfo.playerRespawned()
                cancel=true
            }
            /** 对不可重生玩家 */
            else {
                player.setGameMode( GameMode.Spectator )
                playerInfo.deathState.willDeath = false;
                cancel = true;
            }
    
        }else{
            cancel = true;
        }
    return cancel;
}

/**
 * 【事件类】玩家受伤判定（常规攻击），获取攻击玩家信息
 * @param {EntityHurtAfterEvent} event 
 */
export function hurtByPlayerEvent( event ) {

    /** 获取攻击者和被攻击者的信息 */
    let player = event.hurtEntity;
    let attacker = event.damageSource.damagingEntity?
     (event.damageSource.damagingEntity.typeId == "minecraft:player"? 
      event.damageSource.damagingEntity : event.damageSource.damagingEntity.owner) :
     event.damageSource.damagingProjectile?.getComponent("minecraft:projectile").owner;

    if ( methods.playerIsValid( player ) ) {
        /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
        if ( attacker !== undefined && attacker.typeId === "minecraft:player" ) {
            playerInfo.lastHurt.attacker = attacker;
            const tick = system.currentTick;
            playerInfo.lastHurt.lastAttackedTick = tick;
            system.runTimeout( ()=> {
                if ( playerInfo.lastHurt.lastAttackedTick === tick ) {
                    playerInfo.lastHurt.attacker = undefined;
                }
            },200)
            if ( player.getComponent( "minecraft:is_sheared" ) !== undefined ) {
                player.triggerEvent( "show_armor" );
                player.removeEffect( "minecraft:invisibility" );
                player.sendMessage( { translate: "message.beHitWhenInvisibility" } );
            }
            if ( map().gameStage === 1 && map().randomEventInfo.id == "wither_living" && map().randomEventInfo.triggered === true ) {
                player.addEffect( "wither", 100, { amplifier: 0, showParticles: false } )
            }
        }
    }

}

/**
 * 受伤前事件
 * @param {EntityHurtBeforeEvent} event 
 */
export function hurtDealEvent( event ){
    /**@type {Player} */ let player = event.hurtEntity;
    /**@type {EntityDamageCause} */let cause = event.damageSource.cause;
    /**@type {Entity} */let attacker = event.damageSource.damagingEntity? event.damageSource.damagingEntity : event.damageSource.damagingProjectile;
    /**@type {Player}*/let owner;
    methods.eachValidPlayer( player => {if(player.nameTag === attacker?.getDynamicProperty("owner") || player.nameTag === attacker?.getComponent("minecraft:projectile")?.owner.nameTag) owner = player} )
    /**@type {Player} */let killer = owner? owner : ( attacker?.typeId == "minecraft:player"? attacker : player.bedwarsInfo?.lastHurt?.attacker)
    /**@type {Number}*/let damage = event.damage
    /**@type {methods.BedwarsPlayer} */let playerInfo = player.bedwarsInfo;
    let Ohand = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand)
    let Mhand = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)

    if(player.typeId !== "minecraft:player" ) return;
    if(playerInfo?.deathState.isDeath === true) return;

    switch(cause){
        case "entityExplosion":
            if(attacker && attacker.typeId === "minecraft:tnt"||attacker.typeId === "bedwars:fireball"){
                if( player.getComponent("minecraft:health").currentValue + damage - damage*0.25 <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying"){
                    event.cancel = true;
                    if ( methods.playerIsValid( player ) ) {
                        if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ) { playerInfo.deathState.deathType = cause }
                        else { playerInfo.deathState.deathType = "other" }
                        system.runTimeout( ()=> {
                            owner?.playSound("random.orb", { location: player.location, volume: 15, pitch: 1 })
                            constants.overworld.playSound( "game.player.hurt", player.location, {volume: 15, pitch: 1 } )
                            playerInfo.beforePlayerDied(killer)
                            playerInfo.playerDied(killer)
                        },1)
                    }
                }else if( playerInfo.affordDamage.explosion === false ){
                    event.cancel = true;
                    playerInfo.affordDamage.explosion = true;
                }else{
                    event.damage = damage*0.25
                }
            }
        break;
        case "blockExplosion":
            if( player.getComponent("minecraft:health").currentValue + damage - damage*0.5 <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying"){
                event.cancel = true;
                if ( methods.playerIsValid( player ) ) {
                    if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ) { playerInfo.deathState.deathType = cause }
                    else { playerInfo.deathState.deathType = "other" }
                    system.runTimeout( ()=> {
                        owner?.playSound("random.orb", { location: player.location, volume: 15, pitch: 1 })
                        constants.overworld.playSound( "game.player.hurt", player.location, {volume: 15, pitch: 1 } )
                        playerInfo.beforePlayerDied(killer)
                        playerInfo.playerDied(killer)
                    },1)
                }
            }else if( playerInfo.affordDamage.explosion === false ){
                    event.cancel = true;
                    playerInfo.affordDamage.explosion = true;
            }else{
                event.damage = damage*0.5
            }
            break;
        case "lightning":
            if( player.bedwarsInfo.affordDamage.lightning === false ){
                event.cancel = true;
                player.bedwarsInfo.affordDamage.lightning = true;
                system.run(()=>{
                    player.extinguishFire(false)
                })
            }else if( player.getComponent("minecraft:health").currentValue <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying"){
                event.cancel = true;
                if ( methods.playerIsValid( player ) ) {
                    if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                        playerInfo.deathState.deathType = cause 
                    }else { 
                        playerInfo.deathState.deathType = "other" 
                    }
                    system.runTimeout( ()=> {
                        attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                        constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                        playerInfo.beforePlayerDied(killer)
                        playerInfo.playerDied( killer )
                    },1)
                }
            }
        break;
        case "fireTick":
            if( player.bedwarsInfo.affordDamage.fireTick === false ){
                event.cancel = true;
                player.bedwarsInfo.affordDamage.fireTick = true;
                system.run(()=>{
                    player.extinguishFire(false)
                })
            }else if( player.getComponent("minecraft:health").currentValue <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying"){
                event.cancel = true;
                if ( methods.playerIsValid( player ) ) {
                    if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                        playerInfo.deathState.deathType = cause 
                    }else { 
                        playerInfo.deathState.deathType = "other" 
                    }
                    system.runTimeout( ()=> {
                        attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                        constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                        playerInfo.beforePlayerDied(killer)
                        playerInfo.playerDied( killer )
                    },1)
                }
            }
            break;
        case "entityAttack":
            if(attacker?.typeId === "minecraft:iron_golem"){
                if( player.getComponent("minecraft:health").currentValue + damage*0.5 <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying" ){
                    event.cancel = true;
                    if ( methods.playerIsValid( player ) ) {
                        if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                            playerInfo.deathState.deathType = cause 
                        }else { 
                            playerInfo.deathState.deathType = "other" 
                        }
                        system.runTimeout( ()=> {
                            attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                            constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                            playerInfo.beforePlayerDied(killer)
                            playerInfo.playerDied( killer )
                        },1)
                    }
                }else{
                    event.damage *= 0.5
                }
            }else if( attacker?.typeId === "minecraft:player" ){
                if( attacker.bedwarsInfo.team === player.bedwarsInfo.team ){
                    event.cancel = true;
                }
            }else{
                if( player.getComponent("minecraft:health").currentValue <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying" ){
                    event.cancel = true;
                    if ( methods.playerIsValid( player ) ) {
                        if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                            playerInfo.deathState.deathType = cause 
                        }else { 
                            playerInfo.deathState.deathType = "other" 
                        }
                        system.runTimeout( ()=> {
                            attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                            constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                            playerInfo.beforePlayerDied(killer)
                            playerInfo.playerDied( killer )
                        },1)
                    }
                }
            }
        break;
        case "void":
            event.cancel = true;
            system.run(()=>{
                voidDamageFunction(player)
            })
        break;
        case "fall":
            if( playerInfo.affordDamage.fall === false ){
                event.cancel = true;
                playerInfo.affordDamage.fall = true;    
                return;
            } else if( typeof playerInfo.affordDamage.fall === "number" ){
                const fallReduce = methods.damageTest(player, playerInfo.affordDamage.fall, "fall")
                if( player.getComponent("minecraft:health").currentValue + damage - fallReduce <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying" ){
                    event.cancel = true;
                    if ( methods.playerIsValid( player ) ) {
                        if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                            playerInfo.deathState.deathType = cause 
                        }else { 
                            playerInfo.deathState.deathType = "other" 
                        }
                        system.runTimeout( ()=> {
                            attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                            constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                            playerInfo.beforePlayerDied(killer)
                            playerInfo.playerDied( killer )
                            playerInfo.affordDamage.fall = true;
                        },1)
                    } else {
                        playerInfo.affordDamage.fall = true;
                        event.damage = Math.max(0, damage - fallReduce)
                    }
                } else {
                    playerInfo.affordDamage.fall = true;
                    event.damage = Math.max(0, damage - fallReduce)
                }
            }
            if(player.dimension.getBlock(methods.posPlus(player.location,{x:0,y:-1,z:0}))?.typeId === "minecraft:honey_block"){
                if( player.getComponent("minecraft:health").currentValue + damage*0.75 <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying" ){
                    event.cancel = true;
                    if ( methods.playerIsValid( player ) ) {
                        if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                            playerInfo.deathState.deathType = cause 
                        }else { 
                            playerInfo.deathState.deathType = "other" 
                        }
                        system.runTimeout( ()=> {
                            attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                            constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                            playerInfo.beforePlayerDied(killer)
                            playerInfo.playerDied( killer )
                        },1)
                    }
                }else {
                    event.damage *= 0.25
                    system.run(()=>{
                        const knockbackForce = Math.min(12 * Math.log(1 + methods.sourceDamage(player,damage,"fall")) / Math.log(101), 12)/3
                        player.applyKnockback({x:0,z:0},knockbackForce)
                    })
                }
            }else if( player.getComponent("minecraft:health").currentValue <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying" ){
                    event.cancel = true;
                    if ( methods.playerIsValid( player ) ) {
                        if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                            playerInfo.deathState.deathType = cause 
                        }else { 
                            playerInfo.deathState.deathType = "other" 
                        }
                        system.runTimeout( ()=> {
                            attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                            constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                            playerInfo.beforePlayerDied(killer)
                            playerInfo.playerDied( killer )
                        },1)
                    }
            }
            break;
        default:
            if( player.getComponent("minecraft:health").currentValue <= 0 && Ohand?.typeId !== "minecraft:totem_of_undying" && Mhand?.typeId !== "minecraft:totem_of_undying" ){
                event.cancel = true;
                if ( methods.playerIsValid( player ) ) {
                    if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( cause ) ){
                        playerInfo.deathState.deathType = cause 
                    }else { 
                        playerInfo.deathState.deathType = "other" 
                    }
                    system.runTimeout( ()=> {
                        attacker?.typeId === "minecraft:player"? attacker.playSound("random.orb", { location: attacker.location, volume: 9, pitch: 1 }) : null
                        constants.overworld.playSound( "game.player.hurt", player.location,{ volume: 15, pitch: 1 } )
                        playerInfo.beforePlayerDied(killer)
                        playerInfo.playerDied( killer )
                    },1)
                }
            }
        break;
    }
}

/**
 * 
 * @param {ItemUseAfterEvent} event 
 */
export function playerUseFireball(event) {
    if (event.itemStack.typeId !== "bedwars:fireball") return;

    const player = event.source;
    const headPos = player.getHeadLocation();
    const view = player.getViewDirection();

    const hit = player.getBlockFromViewDirection({ maxDistance: 4 });
    let spawnPos;

    if (hit && hit.block) {
        // 碰撞点的世界坐标
        const hitPoint = {
            x: hit.block.location.x + hit.faceLocation.x,
            y: hit.block.location.y + hit.faceLocation.y,
            z: hit.block.location.z + hit.faceLocation.z,
        };

        // 从眼睛到碰撞点的向量
        const dx = hitPoint.x - headPos.x;
        const dy = hitPoint.y - headPos.y;
        const dz = hitPoint.z - headPos.z;

        // 距离（勾股定理）
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // 回退距离（略大于火球半长 0.25，用 0.6 确保完全在墙外）
        const offset = 0.6;

        // 有效距离必须大于偏移量，否则生成点在眼睛前方 offset 处（兜底）
        let t;
        if (distance > offset) {
            t = (distance - offset) / distance;
        } else {
            t = 0.2; // 如果太近，向前一小段
        }

        // 生成点 = 眼睛 + 方向 * t * 距离（等同于沿视线回退 offset）
        spawnPos = {
            x: headPos.x + dx * t,
            y: headPos.y + dy * t,
            z: headPos.z + dz * t,
        };
    } else {
        // 无命中：向前 2 格
        spawnPos = {
            x: headPos.x + view.x * 2,
            y: headPos.y + view.y * 2,
            z: headPos.z + view.z * 2,
        };
    }

    // 防御 NaN
    if (isNaN(spawnPos.x) || isNaN(spawnPos.y) || isNaN(spawnPos.z)) {
        spawnPos = {
            x: headPos.x + view.x,
            y: headPos.y + view.y + 0.5,
            z: headPos.z + view.z,
        };
    }

    const fireball = player.dimension.spawnEntity("bedwars:fireball", spawnPos);
    fireball.getComponent("minecraft:projectile").shoot(view, { uncertainty: 0 });
    fireball.setOnFire(3000,true)
    player.playSound("mob.blaze.shoot", { volume: 0.5 });

    // 减少物品数量（略）
    const inv = player.getComponent("minecraft:inventory").container;
    const item = inv.getItem(player.selectedSlotIndex);
    if (item) {
        if (item.amount === 1) {
            inv.setItem(player.selectedSlotIndex, undefined);
        } else {
            item.amount--;
            inv.setItem(player.selectedSlotIndex, item);
        }
    }
}

/**
 * 玩家使用烈焰弹时
 * @param {Player} player 
 */
export function usingFireball( player ){
world.sendMessage("true")
    if( player.getDynamicProperty( "prop.fireball.using" ) == false ) return true;

    let view = player.getViewDirection()
    let spawnPos = {
        x: player.getHeadLocation().x + view.x * 2,
        y: player.getHeadLocation().y + view.y * 2,
        z: player.getHeadLocation().z + view.z * 2,
    };
    let fireball = player.dimension.spawnEntity("bedwars:fireball", spawnPos)

    fireball.getComponent("minecraft:projectile").shoot({x: view.x, y: view.y , z: view.z},{ uncertainty: 0 })
    fireball.setOnFire(3000)
    player.playSound("mob.blaze.shoot", {volume: 0.5})
    if(player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex).amount === 1){
        player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,undefined)
    }else{
        let item = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlotIndex)
        item.amount--
        player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex,item)
    }
}

/**
 * 
 * @param {EntityItemPickupBeforeEvent} event 
 */
export function avoidPickUpItems(event){
    let player = event.entity;
    if( player.typeId !== "minecraft:player" ) return;
    let item = event.item;

    const prohibitedItems = [ "minecraft:string"]
    if( prohibitedItems.includes( item.getComponent("minecraft:item").itemStack.typeId ) ){
        event.cancel = true;
        system.run(()=>{
            item.remove();
        })
    }
    if( item.getDynamicProperty("canPickup") === false ){
        event.cancel = true;
    }
}

/**
 * 捡起凋零玫瑰事件
 * @param {EntityItemPickupAfterEvent} event 
 */
export function pickingUpWitherRose( event ){
    let player = event.entity;
    let items = event.items;

    items.forEach( item => {
        if( item.typeId === "bedwars:wither_rose" ){
            player.addEffect( "wither", 20000000, { amplifier: 0 })
        }
    })
}

/**
 * 丢出凋零玫瑰事件
 * @param {EntityItemDropAfterEvent} event
 */
export function droppingWitherRose( event ){
    let player = event.entity;
    let items = event.items;

    items.forEach( item => {
        let itemStack = item.getComponent("minecraft:item").itemStack
        if( itemStack.typeId === "bedwars:wither_rose" ){
            if( methods.hasItemTypeTest(player, "bedwars:wither_rose").filter( i => { return i.getLore()[0] === "诅咒触发了..." } ).length == 0 ){
                player.removeEffect( "wither" )
            }
            itemStack.setLore( [ "诅咒触发了..." ] )
        }
    })
}

/**
 * 【事件类】玩家受伤判定（火球攻击），获取攻击玩家信息；火球爆炸范围4格内均认为是被火球炸伤
 * @param {ProjectileHitBlockAfterEvent | ProjectileHitEntityAfterEvent} event 
 */
export function hurtByFireballsEvent( event ) {

    /** 获取受伤玩家、火球和火球掷出者的信息 */
    let fireball = event.projectile;
    let explosionPos = event.location;
    let fireballOwner = event.source
    if ( fireball.typeId === "bedwars:fireball" && methods.getPlayerNearby( explosionPos, 4 ).length !== 0 ) {
        methods.eachValidPlayer( player => { if ( methods.getPlayerNearby( explosionPos, 4 ).includes( player ) && player !== fireballOwner ) {
            /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
            playerInfo.lastHurt.attacker = fireballOwner;
            system.runTimeout( ()=> {
                playerInfo.lastHurt.attacker = undefined
            },200)
            if ( player.getComponent( "minecraft:is_sheared" ) !== undefined ) {
                player.triggerEvent( "show_armor" );
                player.sendMessage( { translate: "message.beHitWhenInvisibility" } );
            }
        } } )
    }
}

/**
 * 【循环类】玩家受伤计时器，计算玩家自上次受伤的时间，超过 10 秒后则复原
 */
export function playerHurtFunction( player ) {
        /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
        if ( playerInfo.lastHurt.attackedSinceLastAttack < 200 ) {
            playerInfo.lastHurt.attackedSinceLastAttack++
        } else {
            playerInfo.lastHurt.attacker = undefined
        }
}

/**
 * 【事件类】玩家死亡判定，设置玩家的死亡状态，获取死亡类型
 * @param {EntityDieAfterEvent} event 
 */
export function playerDieEvent( event ) {
    let player = event.deadEntity;
    let deathType = event.damageSource.cause;
    let killer = event.damageSource.damagingEntity;
    if ( methods.playerIsValid( player ) ) {
        /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
        if ( [ "entityAttack", "projectile", "fall", "void", "entityExplosion" ].includes( deathType ) ) { playerInfo.deathState.deathType = deathType }
        else { deathType = "other" }
        playerInfo.playerDied( killer )
    }
    /** 如果仅剩一个队伍存活，则该队伍获胜 */
    if ( map().getAliveTeam().length <= 1 ) { map().gameOver( map().getAliveTeam()[0] ) }
}

/**
 * 【循环类】设置玩家跌入虚空后，施加大量的 void 类型伤害
 * @param {Player} player
 */
export function voidDamageFunction( player ) {
        /** @type {methods.BedwarsPlayer} */ let playerInfo = player.bedwarsInfo;
        let Ohand = player.getComponent("minecraft:equippable").getEquipment(EquipmentSlot.Offhand)?.typeId
        let Mhand = player.getComponent("minecraft:equippable").getEquipment(EquipmentSlot.Mainhand)?.typeId
        if(player.location.y < 0){
            if(Ohand === "minecraft:totem_of_undying"){
                playerInfo.teleportPlayerToSpawnpoint();
                system.runTimeout(()=>{
                    player.applyDamage(1000);
                    player.addEffect("regeneration", 600, { amplifier: 2, showParticles: true })
                    player.addEffect("absorption", 900, { amplifier: 1, showParticles: true })
                },1)
            }else if(Mhand === "minecraft:totem_of_undying"){
                playerInfo.teleportPlayerToSpawnpoint();
                system.runTimeout(()=>{
                    player.applyDamage(1000);
                    player.addEffect("regeneration", 30, { amplifier: 2, showParticles: true })
                    player.addEffect("absorption", 45, { amplifier: 1, showParticles: true })
                },1)
            }else{
                if( methods.playerIsAlive( player )){
                    playerInfo.deathState.deathType = "void"
                    playerInfo.beforePlayerDied( playerInfo.lastHurt.attacker? playerInfo.lastHurt.attacker : undefined )
                    playerInfo.playerDied( playerInfo.lastHurt.attacker? playerInfo.lastHurt.attacker : undefined )
                }
            }
        }
        //player.runCommand( "execute if entity @s[x=~,y=0,z=~,dx=0,dy=-60,dz=0] run damage @s 50 void" )
        /**if(player.runCommand( "execute if entity @s[x=~,y=0,z=~,dx=0,dy=-60,dz=0,tag=has_totem] ").successCount !== 0){
            playerInfo.teleportPlayerToSpawnpoint();
            player.applyDamage(1000, "void");
        }*/
}

/**
 * 【循环类】记分板显示功能，按队伍决定展示何种记分板；以及显示玩家血量
 */
export function scoreboardFunction( ) {
    if ( map().gameStage < 1 ) { return true; }
        switch ( map().teamCount ) {
            case 2:
                methods.eachValidPlayer( player => { player.bedwarsInfo.show2TeamsScoreboard() } )
                break;
            case 4:
                methods.eachValidPlayer( player => { player.bedwarsInfo.show4TeamsScoreboard() } )
                break;
            case 8:
                methods.eachValidPlayer( player => { player.bedwarsInfo.show8TeamsScoreboard() } )
                break;
        }

    world.scoreboard.getObjective( "health" ) === undefined ? world.scoreboard.addObjective( "health", "§c❤" ) : null;
    world.scoreboard.getObjectiveAtDisplaySlot( "BelowName" ) === undefined ? world.scoreboard.setObjectiveAtDisplaySlot( "BelowName", { objective: world.scoreboard.getObjective( "health" ) } ) : null
    methods.eachValidPlayer( player => { player.bedwarsInfo.showHealth() } )
}

/**
 * 【循环类】游戏事件功能，在一段时间过后执行一个游戏事件，例如钻石、绿宝石生成点的升级
 */
export function gameEventFunction( ) {
    if(map().gameStage !== 1) return true;
    if ( map().gameEvent.nextEventCountdown > 0 ) { map().gameEvent.nextEventCountdown-=20 }
    else { map().triggerEvent() }
}

/**
 * 【循环类】队伍功能，包括队伍淘汰判定、胜利判定
 */
export function teamFunction() {
    if(map().gameStage !== 1) return true;
    methods.eachTeam( team => {
        /** 如果一个队伍没床并且没有玩家，则该队伍为被淘汰 */
        if ( team.bedInfo.isExist === false && team.getAliveTeamMember().length === 0 && team.isEliminated === false ) { 
            team.setTeamEliminated()
        }
    })
    /** 如果仅剩一个队伍存活，则该队伍获胜 */
    if ( map().getAliveTeam().length <= 1 ) { map().gameOver( map().getAliveTeam()[0] ) }
    
}

/**
 * 【事件类】玩家重进事件，对玩家进行数据显示操作
 * @param {PlayerSpawnAfterEvent} event 
 */
export function dataPlayer( event ){
    let player = event.player
    /**更新货币ui */
    system.runTimeout(()=>{
        methods.showTitle( player, "", "", { onlyUpdate: true } )
    },100)
    /**加载经验值 */
    if( map().gameStage === 0 ){
        methods.loadXpofPlayer( player , { update: true })
    }
}

/**
 * 【事件类】玩家重进事件，玩家进入时恢复数据 | 仅在游戏时试图恢复数据
 * @param {PlayerSpawnAfterEvent} event 
 */
export function playerRejoinEvent( event ) {
    
    /** 获取玩家对应的记分板和队伍 */
    let player = event.player;

    /** 如果重生的玩家是无效玩家，则为重进的玩家 */
    if ( !methods.playerIsValid( player ) ) {

        /** 尝试获取玩家的游戏 ID，只有 ID 一致时方可继续判断 */
        let data = world.scoreboard.getObjective( player.name );
        let runtimeId = 0;
        if ( data !== undefined ) { runtimeId = data.getScore( "runtimeId" ); }

        if ( runtimeId === map().gameId ) {

            /** 尝试获取玩家的队伍信息，并加入进队伍中，此时能保证备份记分板一定存在 */
            let team = 12; team = data.getScore( "team" )
            methods.eachTeam( teamInfo => { if ( teamInfo.id === methods.teamNumberToTeamName( team ) ) { teamInfo.addPlayer( player ) } } )

            /** 如果玩家已经加入到了队伍之中，此时将拥有合法的玩家数据，同时也 */
            if ( methods.playerIsValid( player ) ) { player.bedwarsInfo.dataReset( data ) }
            /** 如果玩家没能加入到队伍中，则为旁观者 */
            else { map().addSpectator( player ); world.scoreboard.removeObjective( player.name ) }

        } else {
            map().addSpectator( player )
        }

    }

    /** 等待期间时执行的内容 */
    if ( map().gameStage < 1 ) { methods.initPlayer( player ) }

}

/**
 * 【事件类】玩家离开事件，玩家退出时备份数据 | 仅限游戏时试图备份
 * @param {PlayerLeaveBeforeEvent} event 
 */
export function playerLeaveEvent( event ) {
    let player = event.player;
    if ( methods.playerIsValid( player ) && map().gameStage >= 1 ) {
        player.bedwarsInfo.dataBackup( player )
    }
}

/**
 * 【循环类】游戏结束功能
 */
export function gameOverEvent( ) {

    map().nextGameCountdown-=20;

    if ( map().nextGameCountdown <= 0 ) { 
        GameSystem.afterGameEvents.afterGameInit.trigger({})
        regenerateMap()
        return true;
    }

}

/**
 * 【事件类】游戏手动设置功能 <lang>
 * @param {ScriptEventCommandMessageAfterEvent} event
 */
export function settingsEvent( event ) {

    let acceptableIds = [
        "bs:start",
        "bs:minWaitingPlayers",
        "bs:gameStartWaitingTime",
        "bs:resourceMaxSpawnTimes",
        "bs:respawnTime",
        "bs:invalidTeamCouldSpawnResources",
        "bs:randomMap",
        "bs:regenerateMap",
        "bs:CreativePlayerCanBreakBlocks"
    ]

    /**
     * 判断执行命令的执行者是否为玩家，并发送给执行者执行消息
     * @param { String | import("@minecraft/server").RawMessage } message
     */
    let sendFeedback = ( message ) => {
        if ( event.sourceType === "Entity" && event.sourceEntity.typeId === "minecraft:player" ) { event.sourceEntity.sendMessage( message ) }
    }

    /**
     * 当命令的参数未给定时，按照特定的格式返回帮助信息和当前值
     * @param {{name:String,typeName:String}[]} pars - 参数信息
     * @param {String} description - 本命令的描述
     * @param {String|Number|Boolean} currentValue - 显示的返回值
     */
    let cmdDescription = (pars, description, currentValue) => {
        const parStrings = pars.map(par => `<${par.name}：${par.typeName}>`).join(' ');
        return `§e${event.id} ${parStrings}§f\n${description}\n§7当前值： ${currentValue}`;
    };

    /**
     * 判断输入的参数是否为布尔值，如果是则执行callback函数，否则报错
     * @param {String} par - 输入的参数
     * @param {String} parName - 输入的参数名称
     * @param {function(Boolean):void} callback
     */
    let booleanPar = ( par, parName, callback ) => {
        if ( par !== "true" && par !== "false" ) { sendFeedback( `§c解析 <${parName}> 参数时出现了问题，该参数只接受布尔值true或false。` ); }
        else if ( par === "true" ) { callback( true ) }
        else { callback( false ) }
    }

    /**
     * 判断输入的参数是否为整数，如果是则执行callback函数，否则报错
     * @param {Number} par - 输入的参数，需转换为数字
     * @param {String} parName - 输入的参数名称
     * @param {function(Number):void} callback
     */
    let intPar = ( par, parName, callback, min = 0 ) => {
        if ( !Number.isInteger( par ) ) { sendFeedback( `§c解析 <${parName}> 参数时出现了问题，该参数只接受整数。` ); }
        else if ( par < min ) { sendFeedback( `§c解析 <${parName}> 参数时出现了问题，该参数不允许小于 ${min} 的值。` ); }
        else ( callback( par ) )
    }

    /**
     * 判断输入的参数是否在所给列表之中，如果是则执行callback函数，否则报错
     * @param {String} par - 输入的参数
     * @param {String} parName - 输入的参数名称
     * @param {String[]} enumArray - 允许的参数
     * @param {function(String):void} callback
     */
    let enumPar = ( par, parName, enumArray, callback ) => {
        if ( !enumArray.includes(par) ) { sendFeedback( `§c解析 <${parName}> 参数时出现了问题，该参数只接受以下值：${enumArray.join(",")}。` ); }
        else ( callback( par ) )
    }

    /** 仅限玩家手动执行命令时执行 */
    if ( acceptableIds.includes( event.id ) ) {
        let par1Name = ""; let par2Name = "";
        let enum1Array = [];
        switch ( event.id ) {
            case "bs:start":
                map().gameStage = 1
                BedwarsMap.gameStart()
                break; 
            case "bs:minWaitingPlayers":
                par1Name = "玩家人数";
                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: "整数" } ],
                        "该值用于控制至少需要多少玩家才可开始游戏。",
                        `§a${methods.settings.minWaitingPlayers}`
                    ) )
                } else {
                    intPar( Number( event.message ), par1Name, par1 => {
                        sendFeedback( `开始游戏需求的玩家人数已更改为${par1}` );
                        methods.settings.minWaitingPlayers = par1;
                    }, 1 )
                }
                break;
            case "bs:gameStartWaitingTime":
                par1Name = "时间";
                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: "整数" } ],
                        "该值用于控制玩家达到规定数目后，多久后开始游戏。单位：游戏刻。",
                        `§a${methods.settings.gameStartWaitingTime}`
                    ) )
                } else {
                    intPar( Number( event.message ), par1Name, par1 => {
                        sendFeedback( `开始游戏的等待时间已更改为${par1}` );
                        methods.settings.gameStartWaitingTime = par1;
                        map().gameStartCountdown = par1;
                    } )
                }
                break;
            case "bs:resourceMaxSpawnTimes":
                par1Name = "资源类型"; enum1Array = [ "iron", "gold", "diamond", "emerald" ];
                par2Name = "最大生成数"
                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: enum1Array.join( " | " ) }, { name: par2Name, typeName: "整数" } ],
                        "该值用于控制游戏中的资源点最多允许生成的数目。",
                        `\n§7iron = §a${methods.settings.resourceMaxSpawnTimes.iron}\n§7gold = §a${methods.settings.resourceMaxSpawnTimes.gold}\n§7diamond = §a${methods.settings.resourceMaxSpawnTimes.diamond}\n§7emerald = §a${methods.settings.resourceMaxSpawnTimes.emerald}`
                    ) )
                } else {
                    enumPar( event.message.split(" ")[0], par1Name, enum1Array, par1 => {
                        intPar( Number(event.message.split(" ")[1]), par2Name, par2 => {
                            sendFeedback( `${par1}的最大生成数已更改为${par2}` );
                            methods.settings.resourceMaxSpawnTimes[par1] = par2;
                        } )
                    } )
                }
                break;
            case "bs:respawnTime":
                par1Name = "玩家类型"; enum1Array = [ "normalPlayers", "rejoinedPlayers" ];
                par2Name = "重生时长"
                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: enum1Array.join( " | " ) }, { name: par2Name, typeName: "整数" } ],
                        "该值用于控制游戏中的玩家重生所需要的时长。单位：游戏刻。",
                        `\n§7normalPlayers = §a${methods.settings.respawnTime.normalPlayers}\n§7rejoinedPlayers = §a${methods.settings.respawnTime.rejoinedPlayers}`
                    ) )
                } else {
                    enumPar( event.message.split(" ")[0], par1Name, enum1Array, par1 => {
                        intPar( Number(event.message.split(" ")[1]), "重生时长", par2 => {
                            sendFeedback( `${par1}类型玩家的重生时长已更改为${par2}游戏刻` );
                            methods.settings.respawnTime[par1] = par2;
                        } )
                    } )
                }
                break;
            case "bs:invalidTeamCouldSpawnResources":
                par1Name = "可生成资源"
                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: "布尔值" } ],
                        "该值用于控制游戏中没有分配到玩家的无效队伍是否能够生成资源。",
                        `§a${methods.settings.invalidTeamCouldSpawnResources}`
                    ) )
                } else {
                    booleanPar( event.message, "可生成资源", par1 => {
                        sendFeedback( `无效队伍生成资源的权限已更改为${par1}` );
                        methods.settings.invalidTeamCouldSpawnResources = par1
                    } )
                }
                break;
            case "bs:randomMap":
                par1Name = "地图类型", enum1Array = [ "allow2Teams", "allow4Teams", "allow8Teams" ]
                par2Name = "允许生成"
                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: enum1Array.join( " | " ) }, { name: par2Name, typeName: "布尔值" } ],
                        "控制游戏中何种类型的地图允许生成。",
                        `\n§7allow2Teams = §a${methods.settings.randomMap.allow2Teams}\n§7allow4Teams = §a${methods.settings.randomMap.allow4Teams}\n§7allow8Teams = §a${methods.settings.randomMap.allow8Teams}`
                    ) )
                } else {
                    enumPar( event.message.split(" ")[0], par1Name, enum1Array, par1 => {
                        booleanPar( event.message.split(" ")[1], par2Name, par2 => {
                            sendFeedback( `${par1}的允许生成状态已更改为${par2}` );
                            methods.settings.randomMap[par1] = par2;
                        } )
                    } )
                }
                break;
            case "bs:regenerateMap":
                let mapList = [];
                if ( methods.settings.randomMap.allow2Teams === true ) { mapList = mapList.concat(validMapsFor2Teams); }
                if ( methods.settings.randomMap.allow4Teams === true ) { mapList = mapList.concat(validMapsFor4Teams); }
                if ( methods.settings.randomMap.allow8Teams === true ) { mapList = mapList.concat(validMapsFor8Teams); }

                par1Name = "生成地图"; enum1Array = enum1Array.concat( "true", mapList )

                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: enum1Array.join( " | " ) } ],
                        "立即生成地图。如果填写为true，则生成一张随机地图。\n生成的地图必须满足地图的生成条件，例如当2队地图禁用时，将不允许生成2队地图。",
                        `---`
                    ) )
                } else {
                    enumPar( event.message, par1Name, enum1Array, par1 => {
                        if ( par1 === "true" ) {
                            regenerateMap();
                            sendFeedback( `即将生成一张随机地图。` );
                        }
                        else {
                            regenerateMap( par1 );
                            sendFeedback( `即将生成地图${par1}。` );
                        }
                    } )
                }
                break;
            case "bs:CreativePlayerCanBreakBlocks":
                par1Name = "可破坏方块"
                if ( event.message === "" ) {
                    sendFeedback( cmdDescription(
                        [ { name: par1Name, typeName: "布尔值" } ],
                        "该值用于控制游戏中创造模式玩家是否能够破坏原版方块。",
                        `§a${methods.settings.CreativePlayerCanBreakBlocks}`
                    ) )
                } else {
                    booleanPar( event.message, "可生成资源", par1 => {
                        sendFeedback( `创造模式玩家破坏方块的权限已更改为${par1}` );
                        methods.settings.CreativePlayerCanBreakBlocks = par1
                    } )
                }
                break;
        }

    } else {
        sendFeedback( `§c检测到不允许的设置项。允许的设置项包括：\n${acceptableIds.join("\n")}` )
    }
}
