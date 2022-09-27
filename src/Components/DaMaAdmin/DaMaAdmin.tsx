import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";

import { FSAWithPayloadAndMeta } from "flux-standard-action";

const dataSource = "usdot/fhwa/npmrds/tmc_identification";
const dataSources = [dataSource];

const pgEnvs = ["dama_dev_1", "dama_dev_2"];

function getApiUrlBase(pgEnv: string) {
  return `http://localhost:3369/dama-admin/${pgEnv}`;
}

async function sendEvent(event: FSAWithPayloadAndMeta, pgEnv: string) {
  const res = await fetch(`${getApiUrlBase(pgEnv)}/events/dispatch`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  const responseEvent = await res.json();

  console.log(JSON.stringify({ responseEvent }, null, 4));

  return responseEvent;
}

const defaultExportDbPath =
  "/home/paul/AVAIL/avail-datasources-watcher/data/ritis/npmrds/npmrdsx_vt_201602_v20220307T181553/npmrdsx_vt_201602_v20220307T181553.sqlite3";

export default function FormPropsTextFields() {
  const [npmrdsExportSqliteDbPath, setNpmrdsExportSqliteDbPath] =
    useState(defaultExportDbPath);

  const [pollIntervalId, setPollIntervalId] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  const [etlContextId, setEtlContextId] = useState<number | null>(null);

  const [pendingQARequests, setPendingQARequests] = useState<
    FSAWithPayloadAndMeta[] | null
  >(null);

  const [pendingViewMeta, setPendingViewMeta] = useState<
    FSAWithPayloadAndMeta[] | null
  >(null);

  const [pgEnv, setPgEnv] = useState(pgEnvs[0]);

  if (pgEnv === "production" || pgEnv === "pluto") {
    throw new Error("Whoa! This code is not ready for production.");
  }

  return (
    <Box
      component="form"
      sx={{
        "& .MuiTextField-root": { m: 1, width: "25ch" },
      }}
      noValidate
      autoComplete="off"
    >
      <div>
        <Grid container spacing={2}>
          <Grid item xs={6} key={0}>
            <Box
              sx={{
                p: 2,
                bgcolor: "background.default",
                display: "grid",
                gridTemplateColumns: { md: "1fr 1fr" },
                gap: 2,
              }}
            >
              <Paper elevation={10}>
                <h3>Data Sources</h3>

                <Box>
                  <FormControl fullWidth>
                    <InputLabel id="demo-simple-select-label">
                      Data Source Name
                    </InputLabel>
                    <Select
                      labelId="layer-selector"
                      id="layer-selector"
                      value={dataSource}
                      label="Layer Name"
                      disabled={false}
                      onChange={(e) => console.log(e.target.value)}
                    >
                      {dataSources.map((dataSrc) => (
                        <MenuItem key={dataSrc} value={dataSrc}>
                          {dataSrc}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <div>
                  <TextField
                    id="npmrds_export_sqlite_db_path"
                    label="npmrds_export_sqlite_db_path"
                    value={npmrdsExportSqliteDbPath}
                    InputProps={{
                      readOnly: true,
                    }}
                    onChange={(e) =>
                      setNpmrdsExportSqliteDbPath(e.target.value)
                    }
                  />
                </div>
                <div>
                  <TextField
                    id="pg_env"
                    label="postgres environment"
                    value={pgEnv}
                    InputProps={{
                      readOnly: true,
                    }}
                    onChange={(e) => setPgEnv(e.target.value)}
                  />
                </div>
                <Button
                  variant="contained"
                  component="label"
                  onClick={async () => {
                    if (pollIntervalId) {
                      clearInterval(pollIntervalId);
                    }

                    setPollIntervalId(null);
                    setEtlContextId(null);
                    setPendingQARequests(null);

                    const damaEvent = await sendEvent(
                      {
                        type: "usdot/fhwa/npmrds/tmc_identification:LOAD_REQUEST",
                        // @ts-ignore
                        payload: {
                          npmrds_export_sqlite_db_path:
                            npmrdsExportSqliteDbPath,
                        },
                        // @ts-ignore
                        meta: {
                          DAMAA: true,
                          user: "mock-admin",
                          timestamp: new Date().toISOString(),
                        },
                      },
                      pgEnv
                    );

                    let {
                      event_id,
                      meta: { etl_context_id },
                    } = damaEvent;

                    setEtlContextId(etl_context_id);

                    async function poll() {
                      const url = new URL(
                        `${getApiUrlBase(pgEnv)}/events/query`
                      );

                      const params = {
                        etl_context_id,
                        event_id,
                        pg_env: pgEnv,
                      };

                      Object.keys(params).forEach((key) =>
                        // @ts-ignore
                        url.searchParams.append(key, params[key])
                      );

                      const response = await fetch(url);

                      const events = await response.json();

                      if (Array.isArray(events) && events.length) {
                        event_id = Math.max(
                          ...events.map(({ event_id }) => event_id)
                        );

                        const qaReqEvents = events.filter(({ type }) =>
                          /:QA_REQUEST$/.test(type)
                        );

                        const viewMetaEvents = events.filter(({ type }) =>
                          /:VIEW_METADATA_TEMPLATE$/.test(type)
                        );

                        console.log(JSON.stringify(events, null, 4));

                        setPendingQARequests([
                          ...(pendingQARequests || []),
                          ...qaReqEvents,
                        ]);

                        setPendingViewMeta([
                          ...(pendingViewMeta || []),
                          ...viewMetaEvents,
                        ]);

                        if (
                          qaReqEvents.length === 0 &&
                          viewMetaEvents.length === 0 &&
                          events.some(({ type }) => /:FINAL$/.test(type))
                        ) {
                          // @ts-ignore
                          clearInterval(pollIntervalId);
                          setPollIntervalId(null);
                          setEtlContextId(null);
                        }
                      }
                    }

                    poll();

                    setPollIntervalId(setInterval(poll, 3000));
                  }}
                >
                  Submit Update Request
                </Button>
                {etlContextId !== null ? (
                  <div>ETL Context ID: {etlContextId}</div>
                ) : null}
                {Array.isArray(pendingQARequests) &&
                pendingQARequests.length ? (
                  <div>
                    <h4>Pending QA Request</h4>
                    <pre>{JSON.stringify(pendingQARequests[0], null, 4)}</pre>
                    <Button
                      variant="contained"
                      component="label"
                      onClick={async () => {
                        const qaReq = pendingQARequests[0];

                        const event = {
                          type: qaReq.type.replace(/REQUEST$/, "APPROVED"),
                          payload: qaReq.payload,
                          meta: {
                            // @ts-ignore
                            ...qaReq.meta,
                            timestamp: new Date().toISOString(),
                          },
                        };

                        sendEvent(event, pgEnv);

                        const newPendingQARequests =
                          pendingQARequests.length > 1
                            ? pendingQARequests.slice(1)
                            : null;

                        setPendingQARequests(newPendingQARequests);
                      }}
                    >
                      Approve QA
                    </Button>
                  </div>
                ) : null}
                {Array.isArray(pendingViewMeta) && pendingViewMeta.length ? (
                  <div>
                    <h4>Pending View Metadata</h4>
                    <pre>{JSON.stringify(pendingViewMeta[0], null, 4)}</pre>
                    <Button
                      variant="contained"
                      component="label"
                      onClick={async () => {
                        const viewMeta = pendingViewMeta[0];

                        const event = {
                          type: viewMeta.type.replace(/TEMPLATE$/, "SUBMITTED"),
                          payload: viewMeta.payload,
                          meta: {
                            // @ts-ignore
                            ...viewMeta.meta,
                            timestamp: new Date().toISOString(),
                          },
                        };

                        sendEvent(event, pgEnv);

                        setPendingViewMeta(pendingViewMeta.slice(1));
                      }}
                    >
                      Approve View Metadata
                    </Button>
                  </div>
                ) : null}
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </div>
    </Box>
  );
}
