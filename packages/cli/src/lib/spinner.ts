let active = false;

export function start(text: string): void {
  active = true;
  process.stderr.write(`  ⠋ ${text}`);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    if (!active) { clearInterval(interval); return; }
    i = (i + 1) % frames.length;
    process.stderr.write(`\r  ${frames[i]} ${text}`);
  }, 80);
  // Store for cleanup
  (start as typeof start & { _interval?: NodeJS.Timeout })._interval = interval;
}

function stop(symbol: string, text: string): void {
  active = false;
  const interval = (start as typeof start & { _interval?: NodeJS.Timeout })._interval;
  if (interval) clearInterval(interval);
  process.stderr.write(`\r  ${symbol} ${text}\n`);
}

export function succeed(text: string): void { stop("✔", text); }
export function fail(text: string): void { stop("✖", text); }
export function info(text: string): void { stop("ℹ", text); }
