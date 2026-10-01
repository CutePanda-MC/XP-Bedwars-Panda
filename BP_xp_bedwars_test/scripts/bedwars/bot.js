import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { SimulatedPlayer, register } from "@minecraft/server-gametest";
import { eachPlayer, randomInt } from "./methods"
import { overworld } from "./constants";
import { map } from "./maps.js";

var mtest; /**Test 存储 */

function getTest(test) {
    mtest = test;
}
register("newTest", "test", getTest).maxTicks(1728000).structureName("test:aaa");
// gametest run startertests:simplemobtest
//StarterTests:simpleMobTest

export function makeBot(event){
    let player = event.sender;
    let mesg = event.message;
    if(player.name!=="CutePandaBL") return;
    if (mesg == "#makebot") {
        system.run(() => {
            newBot(player.location, 1);
        });
        event.cancel = true;
    }
}

const nameArray = ["张哥之雅思八分","妖猫之圈钱梦想","BMW创亖你"]

export function newBot(location, num = 3) {
    const nameArray_copy = []
    for(let index = 0; index<nameArray.length; index++){
        nameArray_copy.push(nameArray[index])
    }
    if (!mtest) {
        world.sendMessage(`未找到Test对象!`)
        return;
    }
    for (let index = 1; index <= num; index++) {
        let random = randomInt(0,nameArray_copy.length-1)
        let sm_player = mtest.spawnSimulatedPlayer(location, `${nameArray_copy[random]}`, GameMode.survival);
        nameArray_copy.splice(random,1)
        sm_player.nametag = `[bot]${sm_player.nametag}`
        let index = sm_players.push(sm_player);
        sm_data[index] = {name: sm_player.nameTag, enemy: undefined}
    }
}
let sm_players = [];
let sm_data = [];

world.afterEvents.entityDie.subscribe((e) => {
    let sm_player = e.deadEntity instanceof SimulatedPlayer ? e.deadEntity : undefined;
    if (sm_player) {
        sm_player.respawn();
    }
});

export function botWork(){
    if(map().gameStage === 2) return true;
    sm_players.forEach((sm_player,index)=>{
        botAttack(sm_player,index);
    })
}

/**
 * @param {SimulatedPlayer} sm_player 
 * @param {number} index
 */
function botAttack(sm_player,index){
    const foundPlayers = findOtherPlayers(sm_player);
    if(foundPlayers.length>0){
        let player = foundPlayers[0];
        if(sm_data[index].enemy?.id === player.id) return;
        sm_data[index].enemy = player;
        sm_player.isSprinting = true;
        sm_player.lookAtEntity(player,10)
        sm_player.navigateToEntity(player,1.0);
    }
}

function findOtherPlayers(sm_player){
    const players = overworld.getPlayers({location: sm_player.location, maxDistance: 20});
    return players.filter(p => p.bedwarsInfo.team !== sm_player.bedwarsInfo.team);
}