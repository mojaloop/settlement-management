
# Casa Settlement Management
This repo contains functionality to close a settlement window and generate a payment file for
reconciliation with the settlement bank. It is currently run as a service that is accessed via the back-end portal and the cronjob.

## TODO
* Expand documentation on environment variables

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

## Debugging

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
kubectl port-forward pi52-centralsettlement-5667f95cd-j7z6d 3007
kubectl port-forward pi52-centralledger-service-5749566cb7-t5cqb 3001
```
Correct pod names can be obtained with `kubectl get pods`. Match the main part of the name (e.g.
operator-settlement, central-settlement or centralledger-service). You can also port-forward the casa-portal-backend, but that's an easy service to run locally and there could be a case where you want to reduce latency.

Now install and run:
```bash
npm install
node index.js
```
