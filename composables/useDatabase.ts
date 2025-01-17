import { useRuntimeConfig } from '#imports';
import {
  createRxDatabase,
  defaultHashSha256,
  addRxPlugin,
  randomCouchString,
} from 'rxdb/plugins/core';
import {
  replicateWebRTC,
  getConnectionHandlerSimplePeer,
} from 'rxdb/plugins/replication-webrtc';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import type { DatabaseCollections, PushupDatabase } from '~/types';

let databasePromise: Promise<PushupDatabase> | null = null;

export const useDatabase = async (): Promise<PushupDatabase> => {
  if (databasePromise) {
    return databasePromise;
  }

  const { mode } = useRuntimeConfig().public;
  let storage: any = getRxStorageDexie();

  databasePromise = (async () => {
    if (mode === 'development') {
      await import('rxdb/plugins/dev-mode').then((module) =>
        addRxPlugin(module.RxDBDevModePlugin)
      );
      await import('rxdb/plugins/validate-ajv').then((module) => {
        storage = module.wrappedValidateAjvStorage({ storage });
      });
    }

    const roomId = window.location.hash;
    if (!roomId || roomId.length < 5) {
      window.location.hash = 'room-' + randomCouchString(10);
      window.location.reload();
    }
    const roomHash = await defaultHashSha256(roomId);

    const database = await createRxDatabase<DatabaseCollections>({
      name: 'pushupdb',
      storage,
      multiInstance: true,
      ignoreDuplicate: true,
    });

    const pushupSchema = {
      title: 'pushups schema',
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: {
          type: 'string',
          maxLength: 100,
        },
        pushupCount: {
          type: 'number',
        },
        state: {
          type: 'string',
          enum: ['open', 'done'],
          maxLength: 4,
        },
        lastChange: {
          type: 'number',
          multipleOf: 1,
          minimum: 0,
          maximum: 9007199254740991,
        },
        createdBy: {
          type: 'string',
          maxLength: 50,
        },
        timestamp: {
          type: 'number',
          multipleOf: 1,
          minimum: 0,
          maximum: 9007199254740991,
        },
      },
      required: [
        'id',
        'pushupCount',
        'state',
        'lastChange',
        'createdBy',
        'timestamp',
      ],
      indexes: ['state', ['state', 'lastChange'], 'createdBy'],
    };

    await database.addCollections({
      pushups: {
        schema: pushupSchema,
      },
    });

    replicateWebRTC({
      collection: database.pushups,
      connectionHandlerCreator: getConnectionHandlerSimplePeer({}),
      topic: roomHash.substring(0, 10),
      pull: {},
      push: {},
    });

    return database;
  })();

  return databasePromise;
};
