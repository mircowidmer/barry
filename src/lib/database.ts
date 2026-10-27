import type { Database as Generated } from './database.types';

// The generator reads only the declared return type of a function, so it cannot tell that a
// command returns null. These overrides state what the migrations guarantee, in one place.

type Public = Generated['public'];
type Functions = Public['Functions'];
type Refusal = Public['Enums']['refusal'];

// Every command returns null when it went through and a Refusal when it did not.
type Command = 'check_in' | 'delete_account' | 'delete_adventure' | 'move_deadline' | 'record_trail' | 'start_adventure';
type Commands = { [K in Command]: Omit<Functions[K], 'Returns'> & { Returns: Refusal | null } };

type SaveAdventure = Omit<Functions['save_adventure'], 'Returns'> & {
  Returns: { adventure_id: string | null; refusal: Refusal | null }[];
};

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Public, 'Functions'> & {
    Functions: Omit<Functions, Command | 'save_adventure'> & Commands & { save_adventure: SaveAdventure };
  };
};

export type { Json } from './database.types';
