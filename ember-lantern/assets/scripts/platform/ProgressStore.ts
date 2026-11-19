import {sys} from 'cc';
import {normalizeProgress, SavedProgress} from '../core/LanternRules';
const STORAGE_KEY='ember-lantern-progress-v1';
export class ProgressStore{
 static read():SavedProgress{try{return normalizeProgress(JSON.parse(sys.localStorage.getItem(STORAGE_KEY)||'null'));}catch{return normalizeProgress(null);}}
 static write(p:SavedProgress):void{try{sys.localStorage.setItem(STORAGE_KEY,JSON.stringify(p));}catch(err){console.warn('[Ember] save unavailable',err);}}
}
