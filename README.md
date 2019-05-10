
# Casa close settlement window cronjob
This repo contains functionality to close a settlement window and generate a payment file for
reconciliation with the settlement bank. It is currently run as a [Kubernetes
cronjob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/). The schedule can be
modified according to the [crontab format](https://en.wikipedia.org/wiki/Cron#Overview).

## TODO
* Expand documentation on environment variables

## Execution model
The Kubernetes cronjob scheduler creates a Kubernetes job, which in turn schedules a container to
execute the job. The container executes the application code within this repo. The cronjob manages
the timing of the job creation, the job manages scheduling of the container, handles retries, and
reports success or failure.

## Build a new container
At the time of writing the build requires you to supply your github ssh private key. This is copied
into the container during the build, but much care has been taken to ensure it does not end up in
the final container. The versioning strategy is currently not especially coherent; but roughly
X.Y.Z, where
* X.Y is the current sprint name
* Z is an incrementing number, reset to zero at the beginning of each sprint

The make command takes the following parameters:
* VER the version to tag the container with- free-form string

See the Makefile for more.
```bash
$ make VER=1.3.3.7 build
```

## Push a container to the repo
See the build section for a description of parameters.
```bash
$ make VER=1.3.3.7 push
```

## Get currently deployed cronjobs
```bash
$ kubectl get cronjobs
NAME                                SCHEDULE    SUSPEND   ACTIVE   LAST SCHEDULE   AGE
pi52-casa-close-settlement-window   0 0 * * *   False     0        17h             1d
```

## Edit a cronjob
The `kubectl edit cronjobs` command will open a yaml representation of the cronjob in your
$EDITOR. To open in a different editor, run `export EDITOR=$name-of-your-editor` first. When you
save and exit, the running job will be updated.

### Edit the cronjob container version
Editing the cronjob container version will cause the next execution of the job to use the updated
container. Run the following command (replacing the cronjob name with the appropriate name from
`kubectl get cronjobs`).
```bash
$ kubectl edit cronjobs pi52-casa-close-settlement-window
```
Once open, find the line something like the following `image:
casablanca-casa-docker-release.jfrog.io/casa-close-settlement-window:5.2.0` and update to the
relevant tag.

### Edit the cronjob schedule
Run the following command (replacing the cronjob name with the appropriate name from `kubectl get
cronjobs`).
```bash
$ kubectl edit cronjobs pi52-casa-close-settlement-window
```
Once open, find the line (near the bottom) something like the following `schedule: 0 0 * * *`.
The schedule can be modified according to the [crontab
format](https://en.wikipedia.org/wiki/Cron#Overview).

## Environment variables

### MIN_WINDOW_AGE_MS
`MIN_WINDOW_AGE_MS` dictates the minimum age in milliseconds of a settlement window to be closed.
If the window is not at least the minimum age, it will not be closed.  It's best for
`MIN_WINDOW_AGE_MS` to be as close as possible to the interval between window closures.  This is
because the first thing the scheduled closure job does is close a window. Therefore, if a failure
occurs later in the process, causing the job to be retried, we won't end up with a number of window
closures. Maximising minWindowAgeMs gives an operator the maximum amount of time to handle failure
as required. Why retry the job? Job failure can be caused by a range of transient conditions,
including database outages, orchestrator scheduling errors, network connection errors. It's better
to be resilient to these and avoid manually processing window closures. Example:
```
# 23 hours and 48 minutes:
# 23.8 * 60 * 60 * 1000 = 85680000
MIN_WINDOW_AGE_MS=85680000
```

### DFSP_CONF
Example file. `1` and `2` are the `participantId` values from the db. `name` and `accountId`
values will go into the settlement file and therefore should correspond to the ("real money")
settlement bank account. WARNING: `accountId` should always be encrypted before submission to the
service. The settlement file is in ISO 20022 pain.001.001.03 format, the country should therefore
be the appropriate [ISO 3166 Alpha 2 code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
```json
{
    "1": {
        "name": "DFSP1",
        "country": "CI",
        "accountId": "1234567890"
    },
    "2": {
        "name": "DFSP2",
        "country": "CI",
        "accountId": "5678"
    }
}
```

## Debugging

If there's a problem, often the latest logs will show that the job was successful, but that the
window was not closed because it was younger than the minimum window age. This occurs when the job
is run, it closes the current window, but fails at a later step. It is then retried by the cronjob
retry mechanism. The retry job detects the new window, realises it is younger than the minimum
window age, and does nothing so it does not make a mess. The latest logs now show "window younger
than minimum age, assume this is a retry".

This can be problematic when debugging, so sometimes it makes sense to edit the cronjob (`kubectl
edit cronjob [cronjob-name]`) to prevent retries. Change the `restartPolicy` property to `Never`.

It's also possible to trigger the job manually. See [running manually](#running-manually).

Additionally, it may help to schedule the job more often. Change the `schedule` property to (for
example, every five minutes) `*/5 * * * *` and the `MIN_WINDOW_AGE_MS` environment variable to
(correspondingly, 4 minutes) `240000`. This means the job will be scheduled every five minutes, but
will not close windows less than four minutes old.

### Did the job run?
See [execution model](#execution-model) to understand more about how k8s schedules jobs. In any
case you should see the pod has been created if the job has run.

```bash
# kubectl get pods
NAME                                                             READY   STATUS         RESTARTS   AGE
pi52-casa-close-settlement-window-1549411200-269wq               0/1     Completed      0          8d
pi52-casa-close-settlement-window-1549497600-krnzq               0/1     Completed      0          7d
pi52-casa-close-settlement-window-1549584000-mqxdv               0/1     Completed      0          6d
pi72-casa-close-settlement-window-1549818000-szjmc               0/1     Completed      0          4d
pi72-casa-close-settlement-window-1549818300-gf855               0/1     Completed      0          4d
pi72-casa-close-settlement-window-1549818600-nxvw4               0/1     Completed      0          4d
pi72-casa-close-settlement-window-1550174400-2pcdc               0/1     Completed      0          16m
pi72-casa-close-settlement-window-1550174700-r4q5f               0/1     Completed      0          11m
....
```

### Reading the logs
```bash
# kubectl logs pi52-casa-close-settlement-window-1549411200-269wq
```
Or sometimes
```bash
# kubectl logs pi52-casa-close-settlement-window-1549411200-269wq --previous=true
```

### Running manually
Look up the cronjob name in your environment with:

```bash
kubectl get cronjobs
```
And use it in the following command (you can use whatever you like for job-name):
```bash
kubectl create job --from=cronjob/<cronjob-name> <job-name>
```

### Running locally
The settlement job depends on the operator settlement service, the central settlement service and
the central ledger service. There's no mechanism in place to run all the dependent services
locally. Therefore, to run locally, it is required to supply the service config in the local
environment, and port-forward required services from a running cluster. Environment variables that
will need to be resolved are visible in config.js, in this repository. The following instructions
assume that you have kubectl access to a running Mowali deployment- if not, get this access before
proceeding.

Port-forwarding, setting up environment variables. You will almost certainly need to change pod
names in the following instructions:
```bash
kubectl port-forward pi52-operator-settlement-7f76fff48-hb4tq 3000
export OPERATOR_SETTLEMENT_ENDPOINT="http://localhost:3000/"
kubectl port-forward pi52-centralsettlement-5667f95cd-j7z6d 3007
export SETTLEMENT_ENDPOINT="http://localhost:3007/v1"
kubectl port-forward pi52-centralledger-service-5749566cb7-t5cqb 3001
export ADMIN_ENDPOINT="http://localhost:3001"
# Have this as low as possible so it doesn't prevent the task from running
export MIN_WINDOW_AGE_MS=0
```
Correct pod names can be obtained with `kubectl get pods`. Match the main part of the name (e.g.
operator-settlement, central-settlement or centralledger-service).

Getting DFSP_CONF from the running instance:
```bash
export DFSP_CONF="$(kubectl get secrets casa-close-settlement-window -o jsonpath='{.data.DFSP_CONF}' | base64 --decode)"
```

Now install and run:
```bash
npm install
node index.js
```
