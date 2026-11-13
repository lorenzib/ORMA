package com.apporma.orma

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.contracts.ExerciseRouteRequestContract
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseRoute
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

// Reads walks from Health Connect for the journal's "Add from Health Connect"
// (app-health.js), the Android twin of HealthWalksPlugin.swift with the same
// four methods and the same answers. Read-only: walking and hiking sessions,
// their distance, and the GPS route of the one the walker picks. ORMA never
// writes to Health Connect.
//
// Health Connect asks about each route on its own the first time ORMA reads
// it ("Allow ORMA to access this route?"), so the list needs only the session
// and distance permissions.
@CapacitorPlugin(name = "HealthWalks")
class HealthWalksPlugin : Plugin() {

    private val scope = MainScope()

    private val readPermissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
    )

    // A fix this far off (metres) or worse is dropped, as hike mode does.
    private val worstAccuracy = 100.0

    private fun client(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE)
            HealthConnectClient.getOrCreate(context) else null

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        call.resolve(JSObject().put("available", client() != null))
    }

    // Shows Health Connect's own permission screen when something is missing;
    // afterwards it returns at once.
    @PluginMethod
    fun requestAccess(call: PluginCall) {
        val health = client() ?: return call.reject("unavailable")
        scope.launch {
            try {
                val granted = health.permissionController.getGrantedPermissions()
                if (granted.containsAll(readPermissions)) {
                    call.resolve(JSObject().put("asked", false))
                } else {
                    val intent = PermissionController.createRequestPermissionResultContract()
                        .createIntent(context, readPermissions)
                    startActivityForResult(call, intent, "accessResult")
                }
            } catch (e: Exception) {
                call.reject(e.message ?: "access")
            }
        }
    }

    @ActivityCallback
    private fun accessResult(call: PluginCall?, result: ActivityResult) {
        call?.resolve(JSObject().put("asked", true))
    }

    // Walking and hiking sessions from the last `days` days, newest first.
    // Without permission the list is empty, as Apple Health's is: the page
    // says where to change it.
    @PluginMethod
    fun listWalks(call: PluginCall) {
        val health = client() ?: return call.reject("unavailable")
        val days = (call.getInt("days") ?: 90).coerceIn(1, 365)
        val limit = (call.getInt("limit") ?: 40).coerceIn(1, 100)
        scope.launch {
            try {
                val walks = JSArray()
                val granted = health.permissionController.getGrantedPermissions()
                if (granted.contains(HealthPermission.getReadPermission(ExerciseSessionRecord::class))) {
                    val since = Instant.now().minus(days.toLong(), ChronoUnit.DAYS)
                    val sessions = health.readRecords(
                        ReadRecordsRequest(
                            recordType = ExerciseSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.after(since),
                            ascendingOrder = false,
                            pageSize = 500,
                        )
                    ).records
                    val canDistance = granted.contains(HealthPermission.getReadPermission(DistanceRecord::class))
                    sessions
                        .filter { it.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_WALKING ||
                                  it.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_HIKING }
                        .take(limit)
                        .forEach { session ->
                            walks.put(
                                JSObject()
                                    .put("id", session.metadata.id)
                                    .put("start", session.startTime.toEpochMilli())
                                    .put("end", session.endTime.toEpochMilli())
                                    .put("metres", if (canDistance) metres(health, session) else 0.0)
                                    .put("kind", if (session.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_HIKING) "hiking" else "walking")
                                    .put("source", appName(session.metadata.dataOrigin.packageName))
                            )
                        }
                }
                call.resolve(JSObject().put("walks", walks))
            } catch (e: Exception) {
                call.reject(e.message ?: "list")
            }
        }
    }

    // The distance the recording app wrote during the session: its distance
    // records inside the session's time, added up.
    private suspend fun metres(health: HealthConnectClient, session: ExerciseSessionRecord): Double =
        try {
            health.readRecords(
                ReadRecordsRequest(
                    recordType = DistanceRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                    dataOriginFilter = setOf(session.metadata.dataOrigin),
                )
            ).records.sumOf { it.distance.inMeters }
        } catch (e: Exception) {
            0.0
        }

    // Android does not let ORMA look up other apps' names, so the walk
    // recorders people use most are named here; any other is left blank.
    private val recorderNames = mapOf(
        "com.google.android.apps.fitness" to "Google Fit",
        "com.sec.android.app.shealth" to "Samsung Health",
        "com.fitbit.FitbitMobile" to "Fitbit",
        "com.garmin.android.apps.connectmobile" to "Garmin Connect",
        "com.strava" to "Strava",
        "de.komoot.android" to "Komoot",
        "com.google.android.apps.healthdata" to "Health Connect",
    )

    private fun appName(packageName: String): String = recorderNames[packageName] ?: ""

    // The GPS route of one session, as [{lat, lng, t}] in time order. A walk
    // recorded indoors, or with location off, has no route: an empty list.
    @PluginMethod
    fun getRoute(call: PluginCall) {
        val health = client() ?: return call.reject("unavailable")
        val id = call.getString("id") ?: return call.reject("no-id")
        scope.launch {
            try {
                val session = health.readRecord(ExerciseSessionRecord::class, id).record
                when (val result = session.exerciseRouteResult) {
                    is ExerciseRouteResult.Data -> call.resolve(points(result.exerciseRoute))
                    is ExerciseRouteResult.ConsentRequired -> {
                        val intent = ExerciseRouteRequestContract().createIntent(context, id)
                        startActivityForResult(call, intent, "routeResult")
                    }
                    else -> call.resolve(points(null))
                }
            } catch (e: Exception) {
                call.reject(e.message ?: "route")
            }
        }
    }

    // The walker answered Health Connect's "access this route?" question.
    // A no comes back as no route.
    @ActivityCallback
    private fun routeResult(call: PluginCall?, result: ActivityResult) {
        val route = ExerciseRouteRequestContract().parseResult(result.resultCode, result.data)
        call?.resolve(points(route))
    }

    private fun points(route: ExerciseRoute?): JSObject {
        val list = JSArray()
        route?.route
            ?.filter { fix -> fix.horizontalAccuracy?.inMeters?.let { it <= worstAccuracy } ?: true }
            ?.sortedBy { it.time }
            ?.forEach { fix ->
                list.put(
                    JSObject()
                        .put("lat", fix.latitude)
                        .put("lng", fix.longitude)
                        .put("t", fix.time.toEpochMilli())
                )
            }
        return JSObject().put("points", list)
    }
}
