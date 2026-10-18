# --extract from a zipped ROM set gives the same tables as from the folder.
#   cmake -DGAME=robotron -DROMS=dir -DWORKDIR=dir -P zip_extract.cmake
# The temporary zip stays inside WORKDIR and is deleted afterwards.
file(REMOVE_RECURSE "${WORKDIR}")
file(MAKE_DIRECTORY "${WORKDIR}/zipsrc")
file(GLOB roms "${ROMS}/*")
file(COPY ${roms} DESTINATION "${WORKDIR}/zipsrc")
execute_process(COMMAND "${CMAKE_COMMAND}" -E tar cf "${WORKDIR}/robotron.zip" --format=zip .
                WORKING_DIRECTORY "${WORKDIR}/zipsrc" RESULT_VARIABLE rc)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "could not build the test zip")
endif()
foreach(src "${ROMS}" "${WORKDIR}/robotron.zip")
  get_filename_component(tag "${src}" NAME)
  execute_process(COMMAND "${GAME}" --extract "${src}" "${WORKDIR}/out_${tag}" RESULT_VARIABLE rc OUTPUT_QUIET)
  if(NOT rc EQUAL 0)
    message(FATAL_ERROR "--extract ${src} failed")
  endif()
endforeach()
get_filename_component(dirtag "${ROMS}" NAME)
foreach(t heroes waves waveparams electrodes)
  execute_process(COMMAND "${CMAKE_COMMAND}" -E compare_files "${WORKDIR}/out_${dirtag}/data/${t}.txt"
                  "${WORKDIR}/out_robotron.zip/data/${t}.txt" RESULT_VARIABLE diff)
  if(NOT diff EQUAL 0)
    message(FATAL_ERROR "${t}.txt differs between folder and zip extraction")
  endif()
endforeach()
file(REMOVE_RECURSE "${WORKDIR}")
message(STATUS "zip and folder extraction match")
