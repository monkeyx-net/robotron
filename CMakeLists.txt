# Native SDL2 build for Linux handhelds and desktops (aarch64, x86_64).
# See SDL2_PORT_PLAN.md. The web build (js/, Vite) is unaffected.
cmake_minimum_required(VERSION 3.13)
project(robotron C)

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

find_package(PkgConfig REQUIRED)
pkg_check_modules(SDL2 REQUIRED IMPORTED_TARGET sdl2)

# Pure C, no SDL: deterministic simulation, asset loading and framebuffer drawing.
add_library(robotron_core STATIC
  src/sim/prng.c
  src/assets/png.c
  src/assets/json.c
  src/assets/assets.c
  src/gfx/fb.c
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
)
target_link_libraries(robotron PRIVATE robotron_core PkgConfig::SDL2 m)

enable_testing()
add_executable(test_prng src/tests/test_prng.c)
target_link_libraries(test_prng PRIVATE robotron_core)
add_test(NAME prng_golden
  COMMAND test_prng ${CMAKE_SOURCE_DIR}/tests/fixtures/prng_golden.txt)

add_executable(test_assets src/tests/test_assets.c)
target_link_libraries(test_assets PRIVATE robotron_core)
add_test(NAME assets COMMAND test_assets ${CMAKE_SOURCE_DIR})

# Reference checks against the arcade in MAME. Only when MAME and a ROM set
# are present: the ROMs are user-supplied and never committed (.gitignore).
set(ROBOTRON_ROM_DIR "${CMAKE_SOURCE_DIR}/robotron" CACHE PATH
    "Directory holding the robotron ROM set (MAME or old 1996 file names)")
find_program(MAME_EXECUTABLE mame)
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
      -DFIXTURE=${CMAKE_SOURCE_DIR}/tests/fixtures/prng_golden.txt
      -P ${CMAKE_SOURCE_DIR}/src/tests/mame/run_probe.cmake)
  set_tests_properties(mame_prng_golden PROPERTIES LABELS mame TIMEOUT 300)
  message(STATUS "MAME reference tests enabled (${MAME_EXECUTABLE}, ROMs in ${ROBOTRON_ROM_DIR})")
else()
  message(STATUS "MAME reference tests disabled (need mame and ${ROBOTRON_ROM_DIR})")
endif()
