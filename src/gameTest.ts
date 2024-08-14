/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as readline from "readline";
import { platform } from "os";
import { glob } from "glob";

export function runAllGameTestsTask() {
  return async () => {
    if ((await glob("scripts/**/*.test.ts")).length === 0) {
      console.error("No game tests found.");
    } else {
      await runSuite();
    }
  };
}

function runSuite(): Promise<void> {
  return new Promise((resolve, reject) => {
    new TestRunner(resolve, reject);
  });
}

class TestResult {
  successes: number = 0;
  failures: number = 0;
  expectedRuns: number = 0;
  constructor(public testClass: string, public TestName: string) {}
  total() {
    return this.successes + this.failures;
  }
  isDone() {
    if (this.expectedRuns - this.total() === 0) {
      return true;
    }
  }
}

interface ControlServerOptions {
  launchSubdir?: string;
}

class TestRunner {
  process: ChildProcessWithoutNullStreams;
  results: Record<string, Record<string, TestResult>> = {};
  stdLog: string[] = [];
  grandTotal = 0;
  handle: any;

  public get isLinux(): boolean {
    return platform() === "linux";
  }

  constructor(
    public resolve: () => void,
    public reject: () => unknown,
    public debugMode: boolean = false,
    public options?: ControlServerOptions
  ) {
    this.process = spawn(
      this.isLinux ? "./bedrock_server" : "./bedrock_server.exe",
      this.getBdsEnv()
    );
    process.stdin.pipe(this.process.stdin);
    this.process.stdout.on("data", (data) => {
      process.stdout.write(data);
    });
    const rl = readline.createInterface({
      input: this.process.stdout,
    });
    rl.on("line", this.stdout);
    const rlerr = readline.createInterface({
      input: this.process.stderr,
    });
    rlerr.on("line", this.stderr);

    this.handle = setInterval(this.checkIfDone, 1000);
  }

  public get cwd(): string {
    return `bds`;
  }

  getBdsEnv() {
    if (this.isLinux) {
      return {
        cwd: this.cwd,
        env: { LD_LIBRARY_PATH: "." },
      };
    } else {
      return {
        cwd: this.cwd,
      };
    }
  }
  checkIfDone = () => {
    if (this.isDone()) {
      const errors = this.printReport();
      if (!this.debugMode) {
        this.kill(errors);
      } else {
        this.grandTotal = 0;
        this.results = {};
      }
    }
  };
  close = () => {
    return new Promise((resolve) => {
      this.process.on("exit", resolve);
      this.process.stdin.write("stop\n");
    });
  };
  printReport() {
    let errorCount = 0;
    for (const testClass in this.results) {
      if (Object.prototype.hasOwnProperty.call(this.results, testClass)) {
        for (const testName in this.results[testClass]) {
          const testInstance = this.results[testClass][testName];
          const { expectedRuns, failures, successes } = testInstance;
          if (expectedRuns === successes) {
            console.log(`${testClass}:${testName} ✅`);
          } else {
            console.log(`${testClass}:${testName} ❌`);
            errorCount++;
          }
        }
      }
    }
    return errorCount;
  }
  onBatchRun = ({
    batchName,
    batchId,
    testCount,
  }: {
    batchName: string;
    batchId: string;
    testCount: string;
  }) => {
    this.grandTotal += Number(testCount);
  };
  stdout = (data: Buffer) => {
    const line: string = data.toString();
    this.stdLog.push(line);
    if (
      line.match(
        /requesting invalid module version|An unrecoverable script watchdog error has occurred|Quit correctly|No script plugins found/g
      )
    ) {
      this.kill(1);
      process.exit(1);
    }

    const batchRunLine = line.match(
      /^Running test batch '(?<batchName>(\w| )+)?:(?<batchId>(\w| )+)' \((?<testCount>\d+) tests\)/
    );
    if (batchRunLine) {
      //@ts-expect-error types
      this.onBatchRun(batchRunLine.groups);
    }
    const onTestStructureLoadedLine = line.match(
      /^onTestStructureLoaded\: (?<testClass>(\w| )+):(?<testName>(\w| )+)/
    );
    if (onTestStructureLoadedLine) {
      //@ts-expect-error types
      this.onTestStructureLoaded(onTestStructureLoadedLine.groups);
    }
    const onTestFailedLine = line.match(
      /^onTestFailed\: (?<testClass>(\w| )+):(?<testName>(\w| )+)( - (?<failureMessage>.*))/
    );
    if (onTestFailedLine) {
      //@ts-expect-error types
      this.onTestFailed(onTestFailedLine.groups);
    }
    const onTestPassedLine = line.match(
      /^onTestPassed\: (?<testClass>(\w| )+):(?<testName>(\w| )+)/
    );
    if (onTestPassedLine) {
      //@ts-expect-error types
      this.onTestPassed(onTestPassedLine.groups);
    }
  };
  onTestStructureLoaded({
    testClass,
    testName,
  }: {
    testClass: string;
    testName: string;
  }) {
    this.results[testClass] = this.results[testClass] || {};
    const res = this.results[testClass]?.[testName];
    if (res) {
      res.expectedRuns += 1;
    } else {
      const newRes = new TestResult(testClass, testName);
      newRes.expectedRuns += 1;
      this.results[testClass][testName] = newRes;
    }
  }
  onTestFailed({
    testClass,
    testName,
  }: {
    testClass: string;
    testName: string;
  }) {
    const res = this.results[testClass]?.[testName];
    if (res) {
      res.failures += 1;
    }
  }
  onTestPassed({
    testClass,
    testName,
  }: {
    testClass: string;
    testName: string;
  }) {
    const res = this.results[testClass]?.[testName];
    if (res) {
      res.successes += 1;
    }
  }
  stderr = (data: Buffer) => {
    const line: string = data.toString();
    this.stdLog.push(line);
  };
  kill = async (errorCount: number) => {
    this.process.kill();
    await this.close();
    if (errorCount > 0) {
      this.reject();
    }
    this.resolve();
    clearInterval(this.handle);
  };
  isDone() {
    let count = 0;
    for (const testClass in this.results) {
      if (Object.prototype.hasOwnProperty.call(this.results, testClass)) {
        for (const testName in this.results[testClass]) {
          if (!this.results[testClass][testName].isDone()) {
            return false;
          } else {
            count += this.results[testClass][testName].total();
          }
        }
      }
    }
    if (count > 0 && count === this.grandTotal) {
      return true;
    } else {
      return false;
    }
  }
}
