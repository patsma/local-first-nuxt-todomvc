import { useRuntimeConfig } from "#imports";
import {
  createRxDatabase,
  defaultHashSha256,
  addRxPlugin,
  randomCouchString,
  deepEqual,
  RXDB_VERSION,
} from "rxdb/plugins/core";
import {
  replicateWebRTC,
  getConnectionHandlerSimplePeer,
} from "rxdb/plugins/replication-webrtc";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

let databasePromise = null;

export const useDatabase = async () => {
  if (databasePromise) {
    return databasePromise;
  }

  const config = useRuntimeConfig();
  const mode = config.public.mode;
  let storage = getRxStorageDexie();

  async function initDatabase() {
    if (mode === "development") {
      await import("rxdb/plugins/dev-mode").then((module) =>
        addRxPlugin(module.RxDBDevModePlugin)
      );
      await import("rxdb/plugins/validate-ajv").then((module) => {
        storage = module.wrappedValidateAjvStorage({ storage });
      });
    }

    const roomId = window.location.hash;
    if (!roomId || roomId.length < 5) {
      window.location.hash = "room-" + randomCouchString(10);
      window.location.reload();
    }
    const roomHash = await defaultHashSha256(roomId);

    const database = await createRxDatabase({
      name:
        "tpdp-" +
        RXDB_VERSION.replace(/\./g, "-") +
        "-" +
        roomHash.substring(0, 10),
      storage,
    });

    const conflictHandler = async (input) => {
      if (deepEqual(input.newDocumentState, input.realMasterState)) {
        return { isEqual: true };
      }
      return {
        isEqual: false,
        documentData:
          input.newDocumentState.lastChange > input.realMasterState.lastChange
            ? input.newDocumentState
            : input.realMasterState,
      };
    };

    await database.addCollections({
      todos: {
        schema: {
          version: 0,
          primaryKey: "id",
          type: "object",
          properties: {
            id: { type: "string", maxLength: 20 },
            name: { type: "string" },
            state: { type: "string", enum: ["open", "done"], maxLength: 10 },
            lastChange: {
              type: "number",
              minimum: 0,
              maximum: 2701307494132,
              multipleOf: 1,
            },
            createdBy: {
              type: "string",
              maxLength: 50,
            },
          },
          required: ["id", "name", "state", "lastChange", "createdBy"],
          indexes: ["state", ["state", "lastChange"]],
        },
        conflictHandler,
      },
    });

    database.todos.preSave((d) => {
      d.lastChange = Date.now();
      return d;
    }, true);

    await database.todos.bulkInsert([
      {
        id: "todo-0",
        name: "👋 Hello Nuxt Nation 2024!",
        lastChange: 0,
        state: "open",
        createdBy: "System",
      },
      {
        id: "todo-1",
        name: "👩‍🚀 Let's explore the future of local-first apps!",
        lastChange: 0,
        state: "open",
        createdBy: "System",
      },
    ]);

    replicateWebRTC({
      collection: database.todos,
      connectionHandlerCreator: getConnectionHandlerSimplePeer({}),
      topic: roomHash.substring(0, 10),
      pull: {},
      push: {},
    }).then((replicationState) => {
      replicationState.error$.subscribe((err) => {
        console.log("replication error:");
        console.dir(err);
      });
      replicationState.peerStates$.subscribe((s) => {
        console.log("new peer states:");
        console.dir(s);
      });
    });
    return database;
  }

  databasePromise = initDatabase();
  return databasePromise;
}; 