export function createQueue(concurrency) {
  const waiting = [];
  let active = 0;

  const pump = () => {
    while (active < concurrency && waiting.length) {
      const { task, resolve, reject } = waiting.shift();
      active++;
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  };

  return {
    run: (task) =>
      new Promise((resolve, reject) => {
        waiting.push({ task, resolve, reject });
        pump();
      }),
    get pending() {
      return waiting.length;
    },
    get active() {
      return active;
    },
  };
}
