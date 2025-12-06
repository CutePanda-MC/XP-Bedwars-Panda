欢迎游玩本addonヾ(≧▽≦*)o~
这是一些注意事项~
===============================
作者: Bilibili@CutePanda-MC
原基础包作者: Bilibili@一只卑微的量筒
===============================
<如何使用此包?>
在你的电脑或手机已经安装了Minecraft Bedrock Edition的情况下,使用基岩版打开这两个文件,耐心等待导入~
导入完成即可游玩~

<无法导入?>
本addon最低版本为1.21.100(实际上只写了1.20.0),如果不更新到那个版本,addon将无法工作!

<遇到bug?>
你可以来这报告你遇到的bug,作者一有时间就会处理哦~

[基本指令]
(部分转自原基础包作者)
该附加包可以使用命令来设置一些可选项。您可以使用这些命令以进行设置和调整包的运行方式，从而改变您的游玩体验。

基本格式
您能够使用的命令格式为

/scriptevent <命令>

每个<命令>都有可接受的参数，如果您不填写这些参数，那么您将获得该命令的帮助信息和当前的默认值。
如果填写了无效的<命令>，那么会报错并返回所有可用的命令。
可用命令列表
所有<命令>列表如下。

bs:minWaitingPlayers <等待人数>
控制至少需要多少玩家方可开始游戏。

<等待人数>：整数，默认值为2。不允许小于2的值。
例 /scriptevent bs:minWaitingPlayers 5：当玩家达到5人后开始倒计时。

bs:gameStartWaitingTime <时间>
控制玩家达到规定人数后，多久后开始游戏。

<时间>：整数，默认值为400。单位：游戏刻。
例 /scriptevent bs:gameStartWaitingTime 1200：当玩家达到规定人数后，开始60秒的倒计时。

bs:resourceMaxSpawnTimes <资源类型> <最大生成数>
控制各类资源的最大生成数。

<资源类型>：仅允许iron、gold、diamond、emerald。
<最大生成数>：整数，不同资源的默认值分别为72、7、8、4。
例 /scriptevent bs:resourceMaxSpawnTimes gold 10：将金锭的最大生成数改为10个。

bs:respawnTime <玩家类型> <重生时长>
控制玩家（包括普通玩家或退出重进的玩家）的重生时间。

<玩家>：仅允许normalPlayers（普通玩家）、rejoinedPlayers（重进玩家）
<重生时长>：整数，默认值为：普通玩家110、重进玩家200。单位：游戏刻。
例 /scriptevent bs:respawnTime rejoinedPlayers 1000：退出重进的玩家需要在50秒后方可重生。

bs:invalidTeamCouldSpawnResources <可生成资源>
控制无效队伍是否允许生成资源。无效队伍是指在开始游戏后，没有分配到队员的队伍。

<可生成资源>：布尔值，默认值为true。
例 /scriptevent bs:invalidTeamCouldSpawnResources false：禁止无效队伍生成资源。

bs:randomMap <地图类型> <允许生成>
控制特定队伍数的地图是否允许生成。

<地图类型>：仅允许allow2Teams、allow4Teams、allow8Teams
<允许生成>：布尔值，默认值均为true。
例 /scriptevent bs:randomMap allow4Teams false：禁止4队地图生成。

bs:regenerateMap <生成地图>
立即生成地图。

<生成地图>：仅允许true或(地图ID)。如果填为true，将随机生成一张地图；如果填为(地图ID)，将生成特定地图ID的地图。下表显示了所有地图的相关信息。不允许生成在bs:randomMap命令中被禁用的地图。
地图ID	地图名称	地图类型
cryptic	神秘	2队经验
frost	极寒	2队经验
garden	花园	2队经验
ruins	废墟	2队经验
picnic	野餐	2队经验
lion_temple	狮庙	2队经验
orchid	兰花	4队经验
chained	铁索连环	4队经验
boletum	蘑菇岛	4队经验
carapace	甲壳	4队经验
archway	拱形廊道	4队经验
bee	蜜蜂(原创图)	4队经验
glacier	冰川	8队经验
rooftop	屋顶	8队经验
amazon	亚马逊	8队经验
例 /scriptevent bs:regenerateMap true：立即生成一张随机地图。 /scriptevent bs:regenerateMap lion_temple：立即生成地图狮庙（必须在2队地图启用情况下才能生成）。

bs:creativePlayerCanBreakBlocks <可破坏方块>
控制原版玩家是否可以破坏原版方块。

<可破坏方块>：布尔值，默认值为false。
例 /scriptevent bs:creativePlayerCanBreakBlocks false：禁止创造模式玩家破坏方块。

==========================
[假人模块]
输入/gametest run newTest:test
再发送#makebot
即可召唤一个假人~
//注：本功能处于测试，请及时汇报bug!
===========================

好了,该说的就这些了,注你游玩愉快!q(≧▽≦q)
