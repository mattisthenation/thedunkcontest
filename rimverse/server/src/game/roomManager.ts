import { World } from './world';
import type { GameMode } from '../../../shared/src/gameMode';
import { DC_ROOM } from '../../../shared/src/dunkConstants';
import { COURTS } from './courts';

export interface Room { id: string; courtId: string; world: World; hadPlayers: boolean; }

export class RoomManager {
  private roomsById = new Map<string, Room>();
  private nextInstance = new Map<string, number>();

  /** First-fit by court + space; else mint `${courtId}-${n}` (v3 roomManager parity). */
  findOrCreateRoom(courtId: string, mode: GameMode): Room {
    const id = COURTS.some((c) => c.id === courtId) ? courtId : COURTS[0].id;
    for (const room of this.roomsById.values()) {
      if (room.courtId === id && room.world.players.size < DC_ROOM.cap) return room;
    }
    const n = (this.nextInstance.get(id) ?? 0) + 1;
    this.nextInstance.set(id, n);
    const world = new World(mode);
    const room: Room = { id: `${id}-${n}`, courtId: id, world, hadPlayers: false };
    // Intercept addPlayer to set hadPlayers eagerly so the reap-check in stepAll
    // correctly sees hadPlayers=true even when players leave between ticks.
    const origAdd = world.addPlayer.bind(world);
    world.addPlayer = (...args: Parameters<typeof world.addPlayer>) => {
      room.hadPlayers = true;
      return origAdd(...args);
    };
    this.roomsById.set(room.id, room);
    return room;
  }

  /** The ONE shared global rimverse (locked decision) — created lazily, never reaped,
   *  capped only by the global MAX_PLAYERS join check in net.ts. Warp arrivals land here. */
  rimverse(): Room {
    let room = this.roomsById.get('rimverse');
    if (!room) {
      room = { id: 'rimverse', courtId: 'rimverse', world: new World('rimverse'), hadPlayers: false };
      this.roomsById.set('rimverse', room);
    }
    return room;
  }

  get(roomId: string): World | undefined {
    return this.roomsById.get(roomId)?.world;
  }

  rooms(): Iterable<Room> {
    return this.roomsById.values();
  }

  /** Step populated rooms; reap a room only once it HAS had players and is now empty —
   *  so the tick can't delete a freshly created room before its first join lands (the race). */
  stepAll(): void {
    for (const [id, room] of this.roomsById) {
      if (room.world.players.size > 0) { room.hadPlayers = true; room.world.step(); }
      else if (room.hadPlayers && id !== 'rimverse') this.roomsById.delete(id);
    }
  }
}
