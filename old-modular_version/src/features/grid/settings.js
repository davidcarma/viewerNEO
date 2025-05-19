import { State, setState } from '../../core/state.js';

export function updateGridSettings(partial) {
  const newGrid = { ...State.grid, ...partial };
  setState({ grid: newGrid });
}

export function getGridSettings() {
  return State.grid;
} 