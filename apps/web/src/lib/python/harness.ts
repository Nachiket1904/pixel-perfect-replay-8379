/**
 * Python that runs the learner's code and then each test, in one fresh namespace per run.
 * Tracebacks hide our own frames, so learners only see lines from their code.
 *
 * Results computed here are a convenience for the learner, never proof: the browser is under the
 * learner's control, so the server stores them as unverified.
 */
export const HARNESS = String.raw`
import traceback as _tb

def _fmt(exc):
    tb = exc.__traceback__
    # Skip frames that belong to this harness (the exec() call sites).
    while tb is not None and tb.tb_frame.f_code.co_filename == "<harness>":
        tb = tb.tb_next
    return "".join(_tb.format_exception(type(exc), exc, tb)).rstrip()

def _padhlo_run(user_code, tests):
    ns = {"__name__": "__main__"}
    try:
        exec(compile(user_code, "<your code>", "exec"), ns)
    except BaseException as exc:  # includes SystemExit and KeyboardInterrupt
        return {"error": _fmt(exc), "tests": []}
    results = []
    for t in tests:
        name = t["name"]
        try:
            exec(compile(t["code"], "<test: " + name + ">", "exec"), ns)
            results.append({"name": name, "passed": True, "message": ""})
        except AssertionError as exc:
            msg = str(exc) or "The check failed."
            results.append({"name": name, "passed": False, "message": msg})
        except BaseException as exc:
            msg = type(exc).__name__ + ": " + str(exc)
            results.append({"name": name, "passed": False, "message": msg})
    return {"error": None, "tests": results}
`;
