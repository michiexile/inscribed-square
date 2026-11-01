// Entry point: the game, or the solver benchmark when the page is opened with ?bench.
if (new URLSearchParams(location.search).has('bench'))
  void import('./benchPage').then((m) => m.showBenchmark());
else void import('./app');
