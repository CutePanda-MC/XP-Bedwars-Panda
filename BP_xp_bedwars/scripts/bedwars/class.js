class GameInstance{
    /**
     * 房间唯一标识（整数，由 GameManager 分配）
     * @type {number}
     */
    id;

    /**
     * 当前房间的地图实例（包含队伍、资源点、游戏阶段、事件计时器等）
     * @type {BedwarsMap}
     */
    map;

    /**
     * 房间内的所有玩家（key: player.id 字符串, value: BedwarsPlayer 实例）
     * @type {Map<string, BedwarsPlayer>}
     */
    players = new Map();

    /**
     * 本房间注册的循环任务 ID 集合（用于统一清理）
     * @type {Set<number>}
     */
    intervalIds = new Set();

    /**
     * 房间当前阶段
     * - 'waiting' : 等待大厅（地图加载/等待玩家）
     * - 'playing' : 游戏进行中
     * - 'ended'   : 游戏已结束（即将重置或关闭）
     * @type {'waiting' | 'playing' | 'ended'}
     */
    status = 'waiting';

    /**
     * 房间独立配置（可覆盖全局 settings，如 minWaitingPlayers、游戏时长等）
     * @type {Object}
     */
    config = {};

    /**
     * 游戏开始倒计时（单位：游戏刻），仅当 status === 'waiting' 时有效
     * @type {number}
     */
    gameStartCountdown = 0;

    /**
     * 游戏结束后，自动关闭或重置房间的倒计时（单位：游戏刻）
     * @type {number}
     */
    nextGameCountdown = 200;

    /**
     * 当前游戏ID（用于验证重连玩家是否属于本局游戏）
     * @type {number}
     */
    gameId;

    /**
     * 旁观者列表（玩家 ID 集合，仅用于查询，实际数据仍在 players 中但标记为旁观者）
     * @type {Set<string>}
     */
    spectators = new Set();

    /**
     * 房间创建时间戳（用于统计或超时清理）
     * @type {number}
     */
    createdAt;
}