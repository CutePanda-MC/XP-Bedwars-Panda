import { MolangVariableMap, system, world } from "@minecraft/server";
import { regenerateMap, map } from "./maps.js";
import * as bedwarsEvents from "./events.js";
import { DurabilityControllerComponent } from "./constants.js"
import { GameSystem } from "./system.js";
import { eachPlayer, eachValidPlayer, loadXpofPlayer } from "./methods.js";

    //system.beforeEvents.startup.subscribe((init)=>{newCommand(init)})

    /** 起床战争功能 - 事件订阅会在地图创建后注册（见下方 regenerateMap 调用位置） */

    GameSystem.afterGameEvents.afterMapCreate.subscribe( ( event ) => {
        GameSystem.Interval( ()=> {
            return bedwarsEvents.effectFunction()
        },20, { tag: "Interval:effectFunction" } )
        GameSystem.Interval( ()=> {
            return bedwarsEvents.waitingFunction()
        },1, { tag: "Interval:waitingFunction" } )
        eachPlayer( player => {
            loadXpofPlayer( player, { update: true })
        })
    } )
    GameSystem.afterGameEvents.afterGameStart.subscribe( ( event ) => {
        GameSystem.Interval( ()=> {
            return bedwarsEvents.ETsimple();
        },5, { tag: "Interval:ETsimple", tick: 1 } )
        GameSystem.Interval( ()=> {
            return bedwarsEvents.spawnResourceFunction();
        },5, { tag: "Interval:spawnResourceFunction", tick: 2 } )
        GameSystem.Interval( ()=> {
            return bedwarsEvents.scoreboardFunction();
        },20, { tag: "Interval:scoreboardFunction" } )
        GameSystem.Interval( ()=> {
            return bedwarsEvents.gameEventFunction();
        },20, { tag: "Interval:gameEventFunction", tick: 2 } )
        GameSystem.Interval( ()=> {
            return bedwarsEvents.teamFunction();
        },20, { tag: "Interval:teamFunction", tick: 2 } )
        eachValidPlayer( (player) => {
            bedwarsEvents.equipmentFunction( { player : player} )
        })
    })
    GameSystem.afterGameEvents.afterGameEnd.subscribe( ( event ) => {
        GameSystem.Interval( ()=> {
            return bedwarsEvents.gameOverEvent()
        },20, { tag: "Interval:gameOverEvent" } )
    })
    GameSystem.afterGameEvents.afterPlayerUpgradeEquipment.subscribe( ( event ) => {
        bedwarsEvents.upgradeEquipment( event )
    })
    GameSystem.afterGameEvents.afterPlayerUpgradeWeapon.subscribe( ( event ) => {
        bedwarsEvents.upgradeWeapon( event )
    })
    GameSystem.afterGameEvents.afterPlayerUpgradeTool.subscribe( ( event ) => {
        bedwarsEvents.upgradeTool( event )
    })
    GameSystem.afterGameEvents.afterPlayerUpgradeReinforced.subscribe( (event) => {
        bedwarsEvents.upgradeEquipment( event )
    })
    GameSystem.afterGameEvents.afterPlayerRespawned.subscribe( ( event ) => {
        bedwarsEvents.equipmentFunction( event )
    })

    // 在世界加载前注册组件
    system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
        itemComponentRegistry.registerCustomComponent(
            "bedwars:durability_controller",
            DurabilityControllerComponent
        );
    });

    /** 立即生成地图（afterMapCreate 监听器已注册） */
    regenerateMap();

    /** 注册世界相关的事件订阅（需要在地图存在时注册） */
    if ( map() !== undefined ) {
        world.beforeEvents.playerBreakBlock.subscribe( event => { bedwarsEvents.playerBreakBlockEvent( event ); } )
        world.afterEvents.itemCompleteUse.subscribe( event => { bedwarsEvents.playerUseItemEvent( event );} )
        world.afterEvents.projectileHitEntity.subscribe( event => { bedwarsEvents.bedBugEvent( event ); bedwarsEvents.hurtByFireballsEvent( event ); bedwarsEvents.enderPearlEvent( event); bedwarsEvents.arrowHit(event); bedwarsEvents.hookHitEvent(event); bedwarsEvents.etherPearlHitEntity( event )} )
        world.afterEvents.projectileHitBlock.subscribe( event => { bedwarsEvents.bedBugEvent( event ); bedwarsEvents.hurtByFireballsEvent( event ); bedwarsEvents.enderPearlEvent( event ); bedwarsEvents.etherPearlHitBlcok( event ) } )
        world.afterEvents.itemStartUseOn.subscribe( event => { bedwarsEvents.dreamDefenderEvent( event ); } )
        world.afterEvents.itemUse.subscribe( event => { bedwarsEvents.playerUseWaterBucketEvent( event ); bedwarsEvents.playerUseBridgeEggEvent( event ); bedwarsEvents.playerUseFireball( event ); bedwarsEvents.playerUseFishingRodEvent(event);} )
        world.afterEvents.itemStartUse.subscribe( event => { bedwarsEvents.startUseEvent( event )})
        world.afterEvents.itemStopUse.subscribe( event => { bedwarsEvents.stopUseEvent( event )})
        world.afterEvents.playerPlaceBlock.subscribe( event => { if(bedwarsEvents.playerUseItemOnHeightLimitEvent( event )) { bedwarsEvents.playerUseTNTEvent( event ); bedwarsEvents.towerAndWall( event ); } } )
        world.beforeEvents.explosion.subscribe( event => { bedwarsEvents.explosionEvents( event ); } )
        world.beforeEvents.entityHurt.subscribe( event => { bedwarsEvents.hurtDealEvent( event )})
        world.afterEvents.entityHurt.subscribe( event => { bedwarsEvents.hurtByPlayerEvent( event );} )
        world.afterEvents.entityHitEntity.subscribe( event => { bedwarsEvents.reboundFireball( event ); bedwarsEvents.playerHitEvent( event )})
        world.afterEvents.entityDie.subscribe( event => { bedwarsEvents.playerDieEvent( event ); bedwarsEvents.dropItems( event ) } )
        world.afterEvents.playerSpawn.subscribe( event => { bedwarsEvents.playerRejoinEvent( event ); bedwarsEvents.dataPlayer( event ) } )
        world.beforeEvents.playerLeave.subscribe( event => { bedwarsEvents.playerLeaveEvent( event ); } )
        world.beforeEvents.chatSend.subscribe( event => { bedwarsEvents.commandEvent( event ); } )
        world.afterEvents.playerInteractWithEntity.subscribe( event => { bedwarsEvents.afterInteractWithTraderEvent( event ); } )
        world.beforeEvents.playerInteractWithEntity.subscribe( event => { bedwarsEvents.beforeInteractWithTraderEvent( event ); } )
        world.beforeEvents.playerInteractWithBlock.subscribe( event => { bedwarsEvents.avoidInteractWithBed( event ); bedwarsEvents.dreamDefenderEvent( event ); bedwarsEvents.spiderTrapEvent( event )} )
        world.afterEvents.playerInventoryItemChange.subscribe( event => { bedwarsEvents.fastShopFunction( event )})
        world.beforeEvents.entityItemPickup.subscribe( event => { bedwarsEvents.xp( event ); bedwarsEvents.avoidPickUpItems( event ); })
        world.afterEvents.entityItemPickup.subscribe( event => { bedwarsEvents.pickingUpWitherRose( event ) })
        world.afterEvents.entityItemDrop.subscribe( event => { bedwarsEvents.avoidDropShopitem( event ); bedwarsEvents.droppingWitherRose( event ) })
        world.afterEvents.playerSwingStart.subscribe( event => { bedwarsEvents.fastStoreFunction( event )})
        world.afterEvents.entityContainerClosed.subscribe( event => { bedwarsEvents.cancelTrading( event )})
        world.afterEvents.entitySpawn.subscribe( event => { bedwarsEvents.etherPearlEvent( event )})
        system.afterEvents.scriptEventReceive.subscribe( event => { bedwarsEvents.settingsEvent( event ) } )
    }