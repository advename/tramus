"""Application layer shared by the HTTP API and the CLI.

Depends on `storage`, `export` and the engine core packages (`video`, `imaging`, `tracking`,
`analysis`). Core-package imports are deferred to inside the functions that use them (rather
than at module top level) so this layer — and the API built on it — stays importable and
testable even before those packages exist; see the module docstrings below for which calls
need them.
"""
