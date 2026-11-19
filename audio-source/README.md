# 原创配乐、音效与可编辑来源

这里保存《撞进怪物窝》的配乐谱面、作曲及渲染脚本、实际交付文件的测量记录，以及采样音源许可。音乐的旋律、和声、段落、配器和力度事件为本项目逐句编写；乐器发声使用有公开许可的 GeneralUser GS 2.0.3 采样音源，由 FluidSynth 离线渲染。它不是现场乐团录音，也不是把九秒合成循环拉长。

## 五段配乐

| 游戏用途 | 文件 | 长度 / 节拍 | 结构与配器 |
| --- | --- | --- | --- |
| 营地 | `music-camp.mp3`《灯下收拾行囊》 | 60.000 秒；96 BPM；3/4；32 小节 | 单簧管与长笛交换主题，尼龙吉他、稀疏弦乐拨奏、竖琴、大提琴；A → 装饰变奏 → 相对大调中段 → 回归 |
| 探索 | `music-explore.mp3`《柜缝里的月光》 | 120.000 秒；112 BPM；4/4；56 小节 | 巴松试探、单簧管主题、长笛应答、低音区停顿、发现宝物、主题回归、退回前奏；拨弦和手鼓保持动作感 |
| 窝主战 | `music-boss.mp3`《窝主守着最后一盏灯》 | 96.000 秒；120 BPM；4/4；48 小节 | 同主题交给圆号，低弦、低铜管、定音鼓与手鼓发展；中段减少声部，再进入完整回归 |
| 胜利 | `win.mp3`《偷得满怀星光》 | 4.500 秒；120 BPM；非循环 | 主题片段经过小调转明亮的大三和弦收束，长笛、圆号、竖琴和钟琴 |
| 退败 | `lose.mp3`《先退一步》 | 2.500 秒；120 BPM；非循环 | 巴松下行应答，大提琴与弱弦乐落回主和弦；留出重试按钮空间 |

共同的可辨主题为 **D–F–E–A / G–E–F–D**。三首长曲改变拍号、音区、应答声部和密度，而不是使用同一段伴奏换速度。`compose_score.py` 中的音高和节奏是显式谱面；固定随机种子仅用于约 ±8 毫秒的演奏错位和小幅力度变化，不用随机音阶生成旋律。吉他与拨奏有空拍，管乐有换气，桥段保留游戏动作音效的空间。

所有交付 MP3 为 **44.1 kHz、双声道、128 kbps**。五段合计 **4,533,307 字节（约 4.32 MiB）**。三首长曲各自放入独立 Asset Bundle，结算短曲与动作音效共用 `sound` Bundle：

| Bundle 名称 | 本脚本写入的游戏资源路径 |
| --- | --- |
| `music-camp` | `assets/music-camp/music-camp.mp3` |
| `music-explore` | `assets/music-explore/music-explore.mp3` |
| `music-boss` | `assets/music-boss/music-boss.mp3` |
| `sound` | `assets/sound/win.mp3`、`assets/sound/lose.mp3` |

准确路径、Bundle 名称和文件校验值记录在 [`music-manifest.json`](music-manifest.json) 的 `assetPath`、`bundle`、`sha256` 字段。`verify_score.py` 会验证这些具体位置，并检查 `assets/` 下没有同名旧副本。资源目录不再使用 `assets/resources/audio/`；重新生成配乐不会把这些文件放回 `resources`。微信分包的实际构建结果仍需用 Creator 与开发者工具验证，目录拆分本身不能证明包体已经合规。

## 可编辑源文件与重建

- [`compose_score.py`](compose_score.py)：完整谱面、配器、MIDI 编码、FluidSynth 离线渲染、尾音折回、混音与 MP3 输出。
- [`midi/`](midi/)：五份标准 MIDI Format 1；960 PPQ；独立命名声部，包含速度、拍号、段落与循环起止标记。可以导入支持 MIDI 的音频工作站继续人工编辑。
- [`music-manifest.json`](music-manifest.json)：每段游戏资源路径、Bundle、时长、循环点、字节数、SHA-256、响度、峰值、剪切样本数和循环边界测量。
- [`verify_score.py`](verify_score.py)：检查 MIDI 数据字节、挂音、谱面长度，以及运行 MP3 与测量记录是否一致；它不判断旋律好听与否。
- [`sfx-manifest.json`](sfx-manifest.json)：另一套分材质动作音效的产物记录。其制作脚本由工程的音效流程维护，不由配乐脚本覆盖。

本次实渲染环境是 Python 3、NumPy 2.3.5、SciPy 1.17.0、FluidSynth 2.4.4 动态库、FFmpeg 7.1.5。Python 包版本记录在 [`requirements.txt`](requirements.txt)。机器还需安装提供 `libfluidsynth` 的系统包，以及包含 `libmp3lame` 编码器的 FFmpeg；脚本调用动态库，不要求另装 FluidSynth 命令行播放器。

从仓库根目录运行：

```sh
# 只生成可编辑 MIDI，不需要音源库或音频设备。
python audio-source/compose_score.py --midi-only

# 先从作者官方页面取得 GeneralUser GS 2.0.3，再传入本机文件路径。
python audio-source/compose_score.py --soundfont /path/to/GeneralUser-GS.sf2

# 只重建一首：camp / explore / boss / win / lose。
python audio-source/compose_score.py --soundfont /path/to/GeneralUser-GS.sf2 --only explore

# 验证当前五份谱面及游戏音频的完整性。
python audio-source/verify_score.py
```

脚本不联网下载，不调用付费生成服务，也不把采样库拷贝进游戏。原始浮点 WAV、24 位混音 WAV 和中间解码文件写入仓库上一级的 `music-work/`，不进入游戏资源；MIDI、脚本、许可与 MP3 才是仓库交付。脚本的 `OUTPUTS` 明确列出上表的五个输出路径，只更新这些文件，不改 `assets/sound/` 中石头、木头、柜子、箭矢等动作音效，也不改 Bundle 的 `.meta` 设置。

当前锁定的 `GeneralUser-GS.sf2` SHA-256 为：

```text
9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe
```

若取得的文件不同，脚本会停止，需先核查音源版本和许可；不要为了绕过校验随意修改哈希。不同 FluidSynth / FFmpeg 版本的再次渲染可能产生不同字节和测量结果；重建后应一并保留新测量记录。

## 已做的音频工程检查

三首长曲按完整小节长度导出。合成器释放与混响尾音渲染后折回开头，因此不用把结尾强制淡出成空白来循环。输出经过轻微高低切和两遍响度处理，保留配器强弱变化，再写入带延迟补偿信息的 MP3。

以下数值测量的是**交付 MP3 解码后的音频**，不是只测未压缩源文件；详细值和校验哈希位于 manifest。

| 文件 | 综合响度 LUFS | True peak dBTP | 响度范围 LU | 首尾瞬时跳变 dBFS | 削波样本 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `music-camp.mp3` | -19.45 | -8.81 | 3.1 | -63.54 | 0 |
| `music-explore.mp3` | -18.45 | -6.58 | 8.7 | -73.77 | 0 |
| `music-boss.mp3` | -18.24 | -2.43 | 10.1 | -59.03 | 0 |
| `win.mp3` | -17.94 | -7.47 | 1.0 | 不循环 | 0 |
| `lose.mp3` | -20.44 | -10.82 | 0.0 | 不循环 | 0 |

长曲的循环设置分别为 `[0, 60]`、`[0, 120]`、`[0, 96]` 秒；两个提示段不要循环。首尾单样本跳变较低，只能说明接缝的一个方面，不能独立证明没有可闻间隙。微信的解码、缓存、后台恢复和 `InnerAudioContext` 行为还须在目标手机验证。MP3 容器报告的帧总时长可能包含编码延迟；本表是支持延迟补偿的解码样本数得到的音乐长度。

## 听感判断与仍需完成的听审

这版的配器选择以“小型木管与弦乐冒险乐队”为目标：营地较轻，探索留有躲藏和停顿，窝主战通过低音、铜管与打击乐增加重量。共同主题、句尾呼吸、和声转位与不同密度的段落都已写入实际音频。采样音源的音头变化、弦乐连奏和铜管力度层仍有限，不能把它宣传成真人乐团或已完成顶级商业录音制作。

当前没有招募人类听审，也没有获得微信真机耳机和外放反馈。响度、波形和 MIDI 校验均不能替代这一步。合并时应听完整段落以及每曲结尾接开头，重点听：探索桥段是否过弱、窝主战强拍是否盖过箭矢预警、碰撞连发时是否需要短暂压低音乐，以及多次循环后主题是否疲劳。发现问题应调整谱面、配器和声部音量，再重新渲染；不能只提高总音量。

## 采样音源来源与许可

- 作者：**S. Christian Collins**。
- 官方介绍：[GeneralUser GS](https://schristiancollins.com/generaluser.php)。
- 官方源码与发行页面：[mrbumpy409 / GeneralUser-GS](https://github.com/mrbumpy409/GeneralUser-GS)。
- 官方许可：[documentation/LICENSE.txt](https://github.com/mrbumpy409/GeneralUser-GS/blob/main/documentation/LICENSE.txt)。
- 取得并核查日期：2026-11-19。随本工程完整保留的许可是 [`licenses/GeneralUser-GS-LICENSE.txt`](licenses/GeneralUser-GS-LICENSE.txt)，标示 GeneralUser GS 2.0.3 / License 2.0。

作者许可明确允许私人和商业音乐创作，以及通过渲染录音获利。但同一许可也明确保留了历史采样来源无法百分之百追溯的说明。本工程完整保留这项说明，不能将该音源标注为 CC0、公有领域、全部自行录制或“来源风险为零”。游戏只分发渲染音乐，不分发约 32 MB 的 SF2 音源库。

本项目创作的谱面、脚本和渲染作品如何对外许可，仍以仓库所有者实际选定的项目许可为准；本说明不会替仓库所有者自动授予开源、CC0 或任意再分发权限。引擎、FluidSynth、FFmpeg 和各开发工具也有各自的许可，不能将其与本项目原创内容混为一谈。
