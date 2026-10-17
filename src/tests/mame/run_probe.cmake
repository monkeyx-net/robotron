# Run a MAME probe headless and compare its output with a fixture.
#   cmake -DMAME=... -DROMPATH=... -DWORKDIR=... -DPROBE=x.lua -DCOUNT=n
#         -DFIXTURE=expected.txt -P run_probe.cmake
foreach(v MAME ROMPATH WORKDIR PROBE COUNT FIXTURE)
  if(NOT DEFINED ${v})
    message(FATAL_ERROR "run_probe.cmake: ${v} not set")
  endif()
endforeach()

set(mame_args robotron
    -rompath "${ROMPATH}"
    -nvram_directory "${WORKDIR}/nvram"
    -cfg_directory "${WORKDIR}/cfg"
    -snapshot_directory "${WORKDIR}/snap"
    -video none -sound none -nothrottle -noplugin data -skip_gameinfo)

# With no NVRAM the arcade boots into FACTORY SETTINGS RESTORED and waits there,
# so the first run in a fresh build dir would capture nothing. Prime it once.
if(NOT EXISTS "${WORKDIR}/nvram/robotron/nvram")
  execute_process(COMMAND "${MAME}" ${mame_args} -seconds_to_run 30 RESULT_VARIABLE rc OUTPUT_QUIET)
  if(NOT rc EQUAL 0 OR NOT EXISTS "${WORKDIR}/nvram/robotron/nvram")
    message(FATAL_ERROR "MAME priming run failed (${rc}); no NVRAM written")
  endif()
endif()

get_filename_component(name "${PROBE}" NAME_WE)
set(out "${WORKDIR}/${name}.txt")
file(REMOVE "${out}")
set(ENV{PROBE_OUT} "${out}")
set(ENV{PROBE_COUNT} "${COUNT}")

execute_process(
  COMMAND "${MAME}" ${mame_args} -seconds_to_run 600 -autoboot_script "${PROBE}"
  RESULT_VARIABLE rc
  OUTPUT_QUIET)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "MAME exited with ${rc}")
endif()

execute_process(COMMAND "${CMAKE_COMMAND}" -E compare_files "${out}" "${FIXTURE}" RESULT_VARIABLE diff)
if(NOT diff EQUAL 0)
  message(FATAL_ERROR "${out} differs from ${FIXTURE}")
endif()
message(STATUS "${name}: MAME output matches ${FIXTURE}")
