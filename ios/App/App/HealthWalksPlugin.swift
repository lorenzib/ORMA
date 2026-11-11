import Foundation
import Capacitor
import HealthKit
import CoreLocation

// Reads walks from Apple Health for the journal's "Add from Apple Health"
// (app-health.js). Read-only: walking and hiking workouts, and the GPS route
// of the one the walker picks. ORMA never writes to Health.
//
// The route goes back to the page, which judges it with the same check as a
// GPX file (gpx-walk.js). Apple never says whether reading was allowed: a
// "no" looks exactly like having no walks, and the page says where to check.
@objc(HealthWalksPlugin)
public class HealthWalksPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthWalksPlugin"
    public let jsName = "HealthWalks"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listWalks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRoute", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()
    // A fix this far off (metres) or worse is dropped, as hike mode does.
    private let worstAccuracy: CLLocationAccuracy = 100

    private var readTypes: Set<HKObjectType> {
        [HKObjectType.workoutType(), HKSeriesType.workoutRoute()]
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    // Shows Apple's own permission sheet the first time; afterwards it returns at once.
    @objc func requestAccess(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.reject("unavailable"); return }
        store.requestAuthorization(toShare: nil, read: readTypes) { asked, error in
            if let error = error { call.reject(error.localizedDescription); return }
            call.resolve(["asked": asked])
        }
    }

    // Walking and hiking workouts from the last `days` days, newest first.
    @objc func listWalks(_ call: CAPPluginCall) {
        let days = max(1, min(365, call.getInt("days") ?? 90))
        let limit = max(1, min(100, call.getInt("limit") ?? 40))
        let since = Date().addingTimeInterval(-Double(days) * 86_400)
        let kinds = NSCompoundPredicate(orPredicateWithSubpredicates: [
            HKQuery.predicateForWorkouts(with: .walking),
            HKQuery.predicateForWorkouts(with: .hiking),
        ])
        let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
            HKQuery.predicateForSamples(withStart: since, end: nil, options: []),
            kinds,
        ])
        let newest = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let query = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: limit,
                                  sortDescriptors: [newest]) { _, samples, error in
            if let error = error { call.reject(error.localizedDescription); return }
            let walks: [[String: Any]] = (samples as? [HKWorkout] ?? []).map { workout in
                [
                    "id": workout.uuid.uuidString,
                    "start": workout.startDate.timeIntervalSince1970 * 1000,
                    "end": workout.endDate.timeIntervalSince1970 * 1000,
                    "metres": HealthWalksPlugin.metres(of: workout),
                    "kind": workout.workoutActivityType == .hiking ? "hiking" : "walking",
                    "source": workout.sourceRevision.source.name,
                ]
            }
            call.resolve(["walks": walks])
        }
        store.execute(query)
    }

    private static func metres(of workout: HKWorkout) -> Double {
        if #available(iOS 16.0, *),
           let type = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning),
           let sum = workout.statistics(for: type)?.sumQuantity() {
            return sum.doubleValue(for: .meter())
        }
        return workout.totalDistance?.doubleValue(for: .meter()) ?? 0
    }

    // The GPS route of one workout, as [{lat, lng, t}] in time order. A walk
    // recorded indoors, or with location off, has no route: an empty list.
    @objc func getRoute(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let uuid = UUID(uuidString: id) else {
            call.reject("no-id"); return
        }
        let find = HKSampleQuery(sampleType: .workoutType(), predicate: HKQuery.predicateForObject(with: uuid),
                                 limit: 1, sortDescriptors: nil) { [weak self] _, samples, error in
            guard let self = self else { return }
            guard let workout = samples?.first as? HKWorkout else {
                call.reject(error?.localizedDescription ?? "not-found"); return
            }
            let routes = HKSampleQuery(sampleType: HKSeriesType.workoutRoute(),
                                       predicate: HKQuery.predicateForObjects(from: workout),
                                       limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, routeSamples, error in
                if let error = error { call.reject(error.localizedDescription); return }
                self.read(routes: (routeSamples as? [HKWorkoutRoute]) ?? [], call: call)
            }
            self.store.execute(routes)
        }
        store.execute(find)
    }

    private func read(routes: [HKWorkoutRoute], call: CAPPluginCall) {
        var points: [[String: Double]] = []
        let lock = NSLock()
        let group = DispatchGroup()
        for route in routes {
            group.enter()
            var finished = false
            let query = HKWorkoutRouteQuery(route: route) { _, locations, done, error in
                lock.lock()
                for fix in locations ?? [] where fix.horizontalAccuracy >= 0 && fix.horizontalAccuracy <= self.worstAccuracy {
                    points.append([
                        "lat": fix.coordinate.latitude,
                        "lng": fix.coordinate.longitude,
                        "t": fix.timestamp.timeIntervalSince1970 * 1000,
                    ])
                }
                let leave = (done || error != nil) && !finished
                if leave { finished = true }
                lock.unlock()
                if leave { group.leave() }
            }
            store.execute(query)
        }
        group.notify(queue: .global(qos: .userInitiated)) {
            points.sort { ($0["t"] ?? 0) < ($1["t"] ?? 0) }
            call.resolve(["points": points])
        }
    }
}
