# Run a MAME probe headless and compare its output with a fixture.
#   cmake -DMAME=... -DROMPATH=... -DWORKDIR=... -DPROBE=x.lua -DCOUNT=n
#         -DFIXTURE=expected.txt -P run_probe.cmake
foreach(v MAME ROMPATH WORKDIR PROBE COUNT FIXTURE)
  if(NOT DEFINED ${v})
    message(FATAL_ERROR "run_probe.cmake: ${v} not set")
  endif()
endforeach()

get_filename_component(name "${PROBE}" NAME_WE)
set(out "${WORKDIR}/${name}.txt")
file(REMOVE "${out}")
set(ENV{PROBE_OUT} "${out}")
set(ENV{PROBE_COUNT} "${COUNT}")

execute_process(
  COMMAND "${MAME}" robotron
          -rompath "${ROMPATH}"
          -nvram_directory "${WORKDIR}/nvram"
          -cfg_directory "${WORKDIR}/cfg"
          -snapshot_directory "${WORKDIR}/snap"
          -video none -sound none -nothrottle -noplugin data -skip_gameinfo
          -seconds_to_run 600
          -autoboot_script "${PROBE}"
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
