# Native SDL2 build for Linux handhelds and desktops (aarch64, x86_64),
# Windows (MinGW) and the web (Emscripten). See SDL2_PORT_PLAN.md.
cmake_minimum_required(VERSION 3.13)
project(robotron VERSION 0.1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()
# The sim must stay bit-exact across architectures: no -ffast-math.
add_compile_options(-Wall -Wextra -Wno-unused-parameter)

option(ROBOTRON_SANITIZE "Build with ASan/UBSan" OFF)
if(ROBOTRON_SANITIZE)
  add_compile_options(-fsanitize=address,undefined -fno-omit-frame-pointer)
  add_link_options(-fsanitize=address,undefined)
endif()

add_library(sdl2 INTERFACE)
if(EMSCRIPTEN)
  # Emscripten's own SDL2 port
  target_compile_options(sdl2 INTERFACE -sUSE_SDL=2)
  target_link_options(sdl2 INTERFACE -sUSE_SDL=2)
else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(SDL2 REQUIRED IMPORTED_TARGET sdl2)
  target_link_libraries(sdl2 INTERFACE PkgConfig::SDL2)
endif()

# Pure C, no SDL: deterministic simulation, asset loading and framebuffer drawing.
add_library(robotron_core STATIC
  src/sim/prng.c
  src/sim/pacing.c
  src/sim/spawn.c
  src/sim/world.c
  src/assets/inflate.c
  src/assets/png.c
  src/assets/zip.c
  src/assets/json.c
  src/assets/assets.c
  src/assets/rom.c
  src/assets/extract.c
  src/game/attract.c
  src/game/entry.c
  src/game/hiscore.c
  src/game/opmenu.c
  src/game/storage.c
  src/gfx/fb.c
  src/gfx/scale.c
  src/gfx/enhance.c
  src/gfx/palette.c
  src/gfx/story.c
  src/gfx/heroes.c
  src/gfx/play.c
  src/gfx/blit.c
  src/gfx/font.c
  src/gfx/title.c
)
target_include_directories(robotron_core PUBLIC src)
target_link_libraries(robotron_core PUBLIC m)
# Development builds also find sprites/ in the source tree; releases ship assets/.
option(ROBOTRON_DEV_ASSETS "Fall back to the source tree's sprites/ at run time" ON)
if(ROBOTRON_DEV_ASSETS)
  target_compile_definitions(robotron_core PRIVATE ROBOTRON_SOURCE_DIR="${CMAKE_SOURCE_DIR}")
endif()

add_executable(robotron
  src/main.c
  src/platform/video.c
  src/platform/input.c
  src/platform/audio.c
)
target_link_libraries(robotron PRIVATE robotron_core sdl2 m)

# Web build: emcmake cmake -S . -B build-web && cmake --build build-web --target serve
# writes <build>/web/index.{html,js,wasm,data} and serves it on localhost.
# Assets go in index.data next to the wasm, not into the binary; the ROM
# tables come from a native build's --extract output (ROBOTRON_WEB_DATA).
if(EMSCRIPTEN)
  set(web_data_default "")
  if(EXISTS "${CMAKE_SOURCE_DIR}/build/assets/data/waves.txt")
    set(web_data_default "${CMAKE_SOURCE_DIR}/build/assets/data")
  endif()
  set(ROBOTRON_WEB_DATA "${web_data_default}" CACHE PATH
      "Extracted ROM tables (assets/data) to bundle; empty = attract only")
  set(ROBOTRON_WEB_PORT 8000 CACHE STRING "Port for the serve target")

  set(web_files)
  foreach(f atlas font_main font_alt)
    list(APPEND web_files "${CMAKE_SOURCE_DIR}/sprites/${f}.png" "${CMAKE_SOURCE_DIR}/sprites/${f}.json")
  endforeach()
  set(web_preload)
  foreach(f ${web_files})
    get_filename_component(name "${f}" NAME)
    list(APPEND web_preload "SHELL:--preload-file '${f}@/assets/sprites/${name}'")
  endforeach()
  list(APPEND web_preload "SHELL:--preload-file '${CMAKE_SOURCE_DIR}/sounds@/assets/sounds'")
  if(ROBOTRON_WEB_DATA)
    list(APPEND web_preload "SHELL:--preload-file '${ROBOTRON_WEB_DATA}@/assets/data'")
    message(STATUS "Web build bundles the ROM tables from ${ROBOTRON_WEB_DATA}")
  else()
    message(STATUS "Web build without ROM tables (attract only): set ROBOTRON_WEB_DATA")
  endif()

  set(shell "${CMAKE_SOURCE_DIR}/src/web/shell.html")
  set_target_properties(robotron PROPERTIES
    OUTPUT_NAME index SUFFIX .html
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/web"
    LINK_DEPENDS "${shell}")
  target_link_options(robotron PRIVATE
    -sALLOW_MEMORY_GROWTH=1 -lidbfs.js "SHELL:--shell-file '${shell}'" ${web_preload})

  find_program(PYTHON3_EXECUTABLE NAMES python3 python)
  add_custom_target(serve
    COMMAND ${CMAKE_COMMAND} -E echo "Robotron: http://localhost:${ROBOTRON_WEB_PORT}/"
    COMMAND ${PYTHON3_EXECUTABLE} -m http.server ${ROBOTRON_WEB_PORT} --bind 127.0.0.1
      --directory "${CMAKE_BINARY_DIR}/web"
    DEPENDS robotron USES_TERMINAL)
  return()  # no dev asset links, packages or tests for the web build
endif()

# The build dir is a runnable layout: <build>/assets holds links to the repo's
# sprites and sounds, and the extracted ROM tables (below), next to the binary.
file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/assets")
foreach(d sprites sounds)
  if(NOT EXISTS "${CMAKE_BINARY_DIR}/assets/${d}")
    if(WIN32)  # symlinks need extra rights on Windows: copy instead
      file(COPY "${CMAKE_SOURCE_DIR}/${d}" DESTINATION "${CMAKE_BINARY_DIR}/assets")
    else()
      file(CREATE_LINK "${CMAKE_SOURCE_DIR}/${d}" "${CMAKE_BINARY_DIR}/assets/${d}" SYMBOLIC)
    endif()
  endif()
endforeach()

# Release archives: cmake --build build --target package_linux / package_portmaster /
# package_windows (configure release builds with -DROBOTRON_DEV_ASSETS=OFF)
foreach(kind linux portmaster windows)
  add_custom_target(package_${kind}
    COMMAND ${CMAKE_COMMAND} -DKIND=${kind} -DSRC=${CMAKE_SOURCE_DIR} -DBIN=${CMAKE_BINARY_DIR}
      -DGAME=$<TARGET_FILE:robotron> -DARCH=${CMAKE_SYSTEM_PROCESSOR} -DVERSION=${PROJECT_VERSION}
      -P ${CMAKE_SOURCE_DIR}/src/packaging/package.cmake
    DEPENDS robotron
    COMMENT "Packaging ${kind} release")
endforeach()

enable_testing()
add_executable(test_prng src/tests/test_prng.c)
target_link_libraries(test_prng PRIVATE robotron_core)
add_test(NAME prng_golden
  COMMAND test_prng ${CMAKE_SOURCE_DIR}/src/tests/fixtures/prng_golden.txt)

add_executable(test_assets src/tests/test_assets.c)
target_link_libraries(test_assets PRIVATE robotron_core)
add_test(NAME assets COMMAND test_assets ${CMAKE_SOURCE_DIR})

add_executable(test_hiscore src/tests/test_hiscore.c)
target_link_libraries(test_hiscore PRIVATE robotron_core)
add_test(NAME hiscore COMMAND test_hiscore)

add_executable(test_enhance src/tests/test_enhance.c)
target_link_libraries(test_enhance PRIVATE robotron_core)
add_test(NAME enhance COMMAND test_enhance)

# The user's ROM set (never committed; see .gitignore) enables the extractor
# steps; MAME as well enables the reference checks against the arcade.
set(ROBOTRON_ROM_DIR "${CMAKE_SOURCE_DIR}/robotron" CACHE PATH
    "Directory holding the robotron ROM set (MAME or old 1996 file names)")
find_program(MAME_EXECUTABLE mame)

if(EXISTS "${ROBOTRON_ROM_DIR}")
  # Development builds: extract the ROM tables next to the binary after each build.
  add_custom_command(TARGET robotron POST_BUILD
    COMMAND robotron --extract ${ROBOTRON_ROM_DIR} ${CMAKE_BINARY_DIR}/assets
    COMMENT "Extracting ROM tables to ${CMAKE_BINARY_DIR}/assets/data" VERBATIM)

  add_test(NAME rom_extract
    COMMAND ${CMAKE_COMMAND} -DGAME=$<TARGET_FILE:robotron> -DROMS=${ROBOTRON_ROM_DIR}
      -DGOLDEN=${CMAKE_SOURCE_DIR}/src/tests/golden/extract.txt -DWORKDIR=${CMAKE_BINARY_DIR}/extract_test
      -P ${CMAKE_SOURCE_DIR}/src/tests/rom_extract.cmake)
  set_tests_properties(rom_extract PROPERTIES LABELS rom)
  add_test(NAME rom_zip_extract
    COMMAND ${CMAKE_COMMAND} -DGAME=$<TARGET_FILE:robotron> -DROMS=${ROBOTRON_ROM_DIR}
      -DWORKDIR=${CMAKE_BINARY_DIR}/zip_test -P ${CMAKE_SOURCE_DIR}/src/tests/zip_extract.cmake)
  set_tests_properties(rom_zip_extract PROPERTIES LABELS rom)

  add_executable(test_world src/tests/test_world.c)
  target_link_libraries(test_world PRIVATE robotron_core)
  add_test(NAME world_flow COMMAND test_world ${CMAKE_BINARY_DIR}/robotron)
  set_tests_properties(world_flow PROPERTIES LABELS rom)

  # Scripted gameplay against committed screenshot hashes (the port's own regression goldens).
  add_test(NAME play_golden
    COMMAND ${CMAKE_COMMAND} -DGAME=$<TARGET_FILE:robotron> -DSCRIPTS=${CMAKE_SOURCE_DIR}/src/tests/scripts
      -DGOLDEN=${CMAKE_SOURCE_DIR}/src/tests/golden/play.txt -DWORKDIR=${CMAKE_BINARY_DIR}/golden
      -P ${CMAKE_SOURCE_DIR}/src/tests/run_golden.cmake)
  set_tests_properties(play_golden PROPERTIES LABELS rom)
  message(STATUS "ROM set found in ${ROBOTRON_ROM_DIR}: extractor steps enabled")
else()
  message(STATUS "No ROM set in ${ROBOTRON_ROM_DIR}: extractor steps and ROM tests disabled")
endif()

if(MAME_EXECUTABLE AND EXISTS "${ROBOTRON_ROM_DIR}")
  # MAME looks files up by its current names; link them so either naming works.
  set(rom_names
    robotron.sb1 2084_rom_1b_3005-13.e4    robotron.sb2 2084_rom_2b_3005-14.c4
    robotron.sb3 2084_rom_3b_3005-15.a4    robotron.sb4 2084_rom_4b_3005-16.e5
    robotron.sb5 2084_rom_5b_3005-17.c5    robotron.sb6 2084_rom_6b_3005-18.a5
    robotron.sb7 2084_rom_7b_3005-19.e6    robotron.sb8 2084_rom_8b_3005-20.c6
    robotron.sb9 2084_rom_9b_3005-21.a6    robotron.sba 2084_rom_10b_3005-22.a7
    robotron.sbb 2084_rom_11b_3005-23.c7   robotron.sbc 2084_rom_12b_3005-24.e7
    robotron.snd video_sound_rom_3_std_767.ic12
    decoder.4    decoder_rom_4.3g          decoder.6    decoder_rom_6.3c)
  set(mame_dir "${CMAKE_BINARY_DIR}/mame")
  file(MAKE_DIRECTORY "${mame_dir}/roms/robotron")
  list(LENGTH rom_names n)
  math(EXPR last "${n} - 1")
  foreach(i RANGE 0 ${last} 2)
    math(EXPR j "${i} + 1")
    list(GET rom_names ${i} old)
    list(GET rom_names ${j} new)
    foreach(src "${ROBOTRON_ROM_DIR}/${new}" "${ROBOTRON_ROM_DIR}/${old}")
      if(EXISTS "${src}")
        file(CREATE_LINK "${src}" "${mame_dir}/roms/robotron/${new}" SYMBOLIC)
        break()
      endif()
    endforeach()
  endforeach()

  add_test(NAME mame_prng_golden
    COMMAND ${CMAKE_COMMAND}
      -DMAME=${MAME_EXECUTABLE} -DROMPATH=${mame_dir}/roms -DWORKDIR=${mame_dir}
      -DPROBE=${CMAKE_SOURCE_DIR}/src/tests/mame/prng_probe.lua -DCOUNT=1000
      -DFIXTURE=${CMAKE_SOURCE_DIR}/src/tests/fixtures/prng_golden.txt
      -P ${CMAKE_SOURCE_DIR}/src/tests/mame/run_probe.cmake)
  set_tests_properties(mame_prng_golden PROPERTIES LABELS mame TIMEOUT 300)
  message(STATUS "MAME reference tests enabled (${MAME_EXECUTABLE})")
else()
  message(STATUS "MAME reference tests disabled (need mame and ${ROBOTRON_ROM_DIR})")
endif()
