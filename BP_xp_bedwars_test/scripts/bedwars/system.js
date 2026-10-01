import { system, world } from "@minecraft/server"

export class GameEvent{

    /**运行池，处理订阅函数 @type {Function[]}*/
    runPool = []

    /**事件id，用于标注 @type {String} */
    id = "";

    /**事件对象传入，由trigger()传入，给予runPool @type {Object} */
    event = {}

    /**
     * 构建器
     * @param {String} id 注册id
     */
    constructor(id){
        this.id = id;
    }

    /**
     * 订阅事件
     * @param {Function} callback  回调
     */
    subscribe(callback){
        return this.runPool.push(callback);
    }

    /**
     * 对事件取消订阅
     * @param {Number} functionId subscribe时返回的id，表示要取消订阅的函数在runPool中的位置
     */
    unsubscribe(functionId){
        this.runPool.splice(functionId,1);
    }

    /**
     * 触发此事件
     * @param {Object} event 传入事件参数
     */
    trigger(event){
        this.event = event;
        this.runPool.forEach( (fun) => {
            fun(this.event)
        })
    }
}

export class GameSystem {

    /**循环池，储存所有循环的id和tag以便管理 @type {Array<{id: Number, tag: String}>}*/
    static intervalPool = []

    /**游戏after事件集 
     * @type {{id:GameEvent}[]} */ 
    static afterGameEvents = {
        afterMapCreate: new GameEvent("afterMapCreate"),
        afterGameStart: new GameEvent("afterGameStart"),
        afterGameEnd: new GameEvent("afterGameEnd"),
        afterGameInit: new GameEvent("afterGameInit"),
        afterPlayerRespawned: new GameEvent("afterPlayerRespawned"),
        afterPlayerUpgradeEquipment: new GameEvent("afterPlayerUpgradeEquipment"),
        afterPlayerUpgradeWeapon: new GameEvent("afterPlayerUpgradeWeapon"),
        afterPlayerUpgradeTool: new GameEvent("afterPlayerUpgradeTool"),
        afterPlayerUpgradeReinforced : new GameEvent("afterPlayerUpgradeReinforced")
    }

    /**
     * 性能循环,在不必要时回调函数清除循环
     * @param {Function} callback 
     * @param {Number} delay 
     * @param {{
     * tag: String // 可选参数，用于标记循环名称，便于调试和管理
     * tick: Number // 可选参数，用于指定多少刻后订阅循环
     * }} options 可选参数对象
     * @returns {Number} Interval ID, 可用于 clearInterval
     */
    static Interval( callback, delay = 1 , options = { tag: "", tick : 0 } ) {
        let handle;
        // 给 delay 一个默认值，避免调用方忘记传参导致 runInterval 抛错
        if(options.tick !== 0){
            system.runTimeout( () => {
                handle = system.runInterval( ()=> {
                    try{
                        let cancel = callback()
                        if ( cancel === true ) {
                            system.clearRun(handle)
                            // 调试指令
                            /**system.run( ()=> {
                                world.sendMessage(`[GameSystem] Interval cleared: ${options.tag} (ID: ${handle})`)
                            })*/
                        }
                    }catch(e){
                        // 捕获回调内异常以避免整个系统崩溃
                        // world.sendMessage && world.sendMessage(`GameSystem.Interval callback error: ${e}`)
                    }
                }, delay)
            },options.tick)
        }else{
            handle = system.runInterval( ()=> {
                try{
                    let cancel = callback()
                    if ( cancel === true ) {
                        system.clearRun(handle)
                        // 调试指令
                        /**system.run( ()=> {
                            world.sendMessage(`[GameSystem] Interval cleared: ${options.tag} (ID: ${handle})`)
                        })*/
                    }
                }catch(e){
                    // 捕获回调内异常以避免整个系统崩溃
                    // world.sendMessage && world.sendMessage(`GameSystem.Interval callback error: ${e}`)
                }
            }, delay)
        }
        //调试指令
        /**system.run( ()=> {
            world.sendMessage(`[GameSystem] Interval registered: ${options.tag} (ID: ${handle})`)
        })*/
        // 将 handle 和 tag 存入 intervalPool 以便管理
        this.intervalPool.push({ id: handle, tag: options.tag })
        return handle;
    }

    /**
     * 外部调用以取消循环
     * @param {Number|String} idOrTag 
     */
    static clearInterval( idOrTag ) {
        const index = this.intervalPool.findIndex( item => item.id === idOrTag || item.tag === idOrTag )
        if ( index !== -1 ) {
            system.clearRun(this.intervalPool[index].id)
            this.intervalPool.splice(index,1)
        }
    }
}