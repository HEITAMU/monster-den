import type {GameState,Phase,ToolId,Vec2} from './core/types';

export interface ObjectiveGuide {
  stage:'board'|'treasure'|'exit';
  title:string;
  hint:string;
  target:Vec2;
}

export interface ToolPresentation {name:string;status:string;active:boolean;}

type ObjectiveState=Pick<GameState,'roomIndex'|'obstacles'|'treasure'|'exit'>;

/** Derive the next objective from the saved world; no separate tutorial progress is needed. */
export function objectiveGuide(state:ObjectiveState):ObjectiveGuide {
  // Taking the treasure is authoritative even if the player bypassed the first board.
  if(state.treasure.taken)return {
    stage:'exit',title:'前往出口',hint:'宝物到手，冲向发光出口',
    target:{x:state.exit.x,y:state.exit.y},
  };
  if(state.roomIndex===0){
    const board=state.obstacles.find(o=>o.id==='welcome-board'&&o.kind==='board'&&!o.destroyed);
    if(board)return {
      stage:'board',title:'撞开木栏',hint:'向上撞木栏，或向左撞发光菌核',
      target:{x:board.x,y:board.y},
    };
  }
  let hint='撞到宝箱，拿走宝物';
  switch(state.roomIndex){
    case 1:hint='借柜子挡箭，绕到后方拿宝物';break;
    case 2:hint=state.obstacles.some(o=>o.id==='thick-board'&&!o.destroyed)
      ?'撞开中间厚木栏，去右上拿宝物':'穿过中间通道，去右上拿宝物';break;
    case 3:hint='绕过中央石柱，去右上角拿宝物';break;
    case 4:hint='留意窝主冲锋，拿走它身后宝物';break;
  }
  return {stage:'treasure',title:'拿走宝物',hint,target:{x:state.treasure.x,y:state.treasure.y}};
}

/** `active` means a ready active tool during a shot, never a passive effect or a finished room. */
export function toolPresentation(tool:ToolId,phase:Phase,ready:boolean):ToolPresentation {
  if(tool==='none')return {name:'工具未携带',status:'过房可选',active:false};
  if(tool==='heavy')return {name:'重撞拳套',status:'自动生效',active:false};
  const name=tool==='grip'?'抓停重瞄':'回旋折返';
  if(phase==='victory'||phase==='game_over')return {name,status:'本局已结束',active:false};
  if(phase==='room_clear')return {name,status:'进入下一房后恢复',active:false};
  if(phase==='enemies')return {name,status:'等待敌人行动结束',active:false};
  if(!ready)return {name,status:'本回合已用',active:false};
  return phase==='moving'?{name,status:'现在可以点按',active:true}
    :{name,status:'冲撞时可用',active:false};
}

const GENERAL_ADVICE:Record<ToolId,string>={
  none:'拿到宝物后，进入发光出口',
  heavy:'自动加强冲撞，厚木栏可一击撞开',
  grip:'冲撞中点抓停，再次推杆重新瞄准',
  return:'冲撞中点回旋，朝本次起点折返',
};

// Indices match the authored rooms, starting at zero. These suggest actions, not safe routes.
const ROOM_ADVICE:Partial<Record<number,Record<ToolId,string>>>={
  1:{
    none:'借柜子挡住横向箭路，再绕向上方',
    heavy:'把柜子推上箭路，再从侧面绕行',
    grip:'经过柜子侧面时抓停，重瞄上方',
    return:'柜子推到箭路后，可折返调整位置',
  },
  2:{
    none:'厚木栏要分回合撞，留意下方箭路',
    heavy:'重撞可一击破厚木栏，穿过中路',
    grip:'过木栏后抓停，转向右上宝物',
    return:'冲过中路后可折返，重新调整落点',
  },
  3:{
    none:'宝物在右上，出口在左上',
    heavy:'从侧面推上方柜子，调整横向通路',
    grip:'绕到右侧后抓停，转向右上宝物',
    return:'向右探路后可折返，出口在左上',
  },
  4:{
    none:'绕到窝主身后取宝，留意冲锋线',
    heavy:'从侧面推开柜子，给绕行留出空间',
    grip:'绕过立柱后抓停，转向窝主身后',
    return:'经过窝主侧面可折返，留意冲锋线',
  },
};

export function nextRoomAdvice(nextIndex:number,tool:ToolId):string {
  return ROOM_ADVICE[nextIndex]?.[tool]??GENERAL_ADVICE[tool];
}
