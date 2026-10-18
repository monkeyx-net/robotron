# Lay out and archive a release.
#   cmake -DKIND=linux|portmaster -DSRC=<repo> -DBIN=<build dir> -DGAME=<binary>
#         -DARCH=<x86_64|aarch64> -DVERSION=<x.y.z> -P package.cmake
# Archives land in <build dir>/packages/.
foreach(v KIND SRC BIN GAME ARCH VERSION)
  if(NOT DEFINED ${v})
    message(FATAL_ERROR "package.cmake: ${v} not set")
  endif()
endforeach()

set(out "${BIN}/packages")
set(stage "${out}/stage-${KIND}-${ARCH}")
file(REMOVE_RECURSE "${stage}")

if(KIND STREQUAL "linux")
  set(root "${stage}/robotron-${VERSION}-linux-${ARCH}")
  set(exe_name "robotron")
else()
  set(root "${stage}/robotron")
  set(exe_name "robotron.${ARCH}")
endif()
set(assets "${root}/assets")

file(MAKE_DIRECTORY "${assets}/sprites" "${assets}/sounds")
file(COPY "${GAME}" DESTINATION "${root}")
file(RENAME "${root}/robotron" "${root}/${exe_name}.tmp")
file(RENAME "${root}/${exe_name}.tmp" "${root}/${exe_name}")
foreach(f atlas font_main font_alt)
  file(COPY "${SRC}/sprites/${f}.png" "${SRC}/sprites/${f}.json" DESTINATION "${assets}/sprites")
endforeach()
file(GLOB wavs "${SRC}/sounds/*.wav")
file(COPY ${wavs} DESTINATION "${assets}/sounds")
if(EXISTS "${BIN}/assets/data/waves.txt")
  file(COPY "${BIN}/assets/data" DESTINATION "${assets}")
else()
  message(WARNING "no extracted ROM tables in ${BIN}/assets/data: players must run --extract")
endif()
file(COPY "${SRC}/NOTICE" "${SRC}/LICENSE" DESTINATION "${root}")
file(COPY "${SRC}/src/packaging/README-native.txt" DESTINATION "${root}")

if(KIND STREQUAL "linux")
  set(archive "${out}/robotron-${VERSION}-linux-${ARCH}.tar.gz")
  execute_process(COMMAND "${CMAKE_COMMAND}" -E tar czf "${archive}" "robotron-${VERSION}-linux-${ARCH}"
                  WORKING_DIRECTORY "${stage}" RESULT_VARIABLE rc)
else()
  file(COPY "${SRC}/src/packaging/portmaster/Robotron 2084.sh" DESTINATION "${stage}")
  file(COPY "${SRC}/src/packaging/portmaster/port.json" "${SRC}/src/packaging/portmaster/gameinfo.xml"
       DESTINATION "${root}")
  # screenshot: the game's own first wave, rendered headless
  file(WRITE "${stage}/shot.txt" "1 start\n2\n")
  execute_process(COMMAND "${CMAKE_COMMAND}" -E env SDL_VIDEODRIVER=dummy ROBOTRON_SAVE_DIR=${stage}/save
                  "${GAME}" --input "${stage}/shot.txt" --frames 240 --screenshot "${root}/screenshot.png"
                  RESULT_VARIABLE shot_rc OUTPUT_QUIET ERROR_QUIET)
  if(NOT shot_rc EQUAL 0)
    message(WARNING "could not render the PortMaster screenshot")
  endif()
  set(archive "${out}/robotron-${VERSION}-portmaster-${ARCH}.zip")
  execute_process(COMMAND "${CMAKE_COMMAND}" -E tar cf "${archive}" --format=zip "Robotron 2084.sh" robotron
                  WORKING_DIRECTORY "${stage}" RESULT_VARIABLE rc)
endif()
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "archiving failed")
endif()
file(REMOVE_RECURSE "${stage}")
message(STATUS "wrote ${archive}")
