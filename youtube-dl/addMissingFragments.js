(function() {
  "use strict";

  const fs = require("fs");

  function addMissingFragments(jsonPath) {
    // Ensure the file exists.
    if (!fs.existsSync(jsonPath)) return;

    // Read the file and parse it as JSON.
    const json = JSON.parse(fs.readFileSync(jsonPath, { encoding: 'utf8' }));

    json.formats.forEach((format, ind) => {
      if (!format.fragments) return;
      if (format.fragments[0].path.split('/')[0] === 'range') return;

      // Get the most common fragment duration.
      let durations = [];
      const durationCount = {};
      format.fragments.forEach(fragment => {
        if (!fragment.hasOwnProperty('duration')) return;
        const duration = fragment.duration;
        if (durations.indexOf(duration) < 0) {
          durations.push(duration);
          durationCount[`${duration}`] = 1;
        } else {
          durationCount[`${duration}`] += 1;
        }
      });
      if (durations.length < 1) {
        console.info(`No fragments for format ${ind} have a duration!`);
        return;
      }
      durations.sort((e1, e2) => durationCount[`${e2}`] - durationCount[`${e1}`]);
      const duration = durations[0];

      // Find the maximum fragment index.
      const maxFrag = format.fragments.reduce((maxFrag, fragment) => {
        const fragNum = parseFloat(fragment.path.split('/')[1]);
        return (fragNum > maxFrag ? fragNum : maxFrag);
      }, -Infinity);

      // Create an array to hold fragments up to the maximum index.
      const fragments = new Array(maxFrag + 1);

      // Fill the array with the known fragments.
      format.fragments.forEach(fragment => {
        const fragNum = parseFloat(fragment.path.split('/')[1]);
        fragments[fragNum] = fragment;
      });

      // Fill in any missing fragments.
      let anyFixed = false;
      for (let i = 0; i <= maxFrag; ++i) {
        if (fragments[i]) continue;
        anyFixed = true;
        fragments[i] = {
          path: `sq/${i}`,
          duration: duration,
        };
      }

      // Use the new fragment array.
      format.fragments = fragments;
    });

    // Stringify and write the fixed json back to its original location.
    fs.writeFileSync(jsonPath, JSON.stringify(json));
  }

  if (process.argv.length < 3) {
    console.error(`No path parameter found!`);
    return;
  }

  // Get the path and replace backslashes with regular slashes.
  const path = process.argv[2].replace(/\\/g, "/");

  if (!fs.existsSync(path)) {
    console.error(`Location ${path} does not exist!`);
    return;
  }

  addMissingFragments(path);
})();
