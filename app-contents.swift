// This contains the only file with anything in it from the iOS application. 
// All the other files are boilerplate.
// The app is very simple..

//
//  ContentView.swift
//  minerva_app
//
//  Created by Daniel McCann-Sayles on 7/4/24.
//

import SwiftUI
import AVFoundation

let address = "1.2.3.4"
let port = 3000
let serverAddress = "http://\(address):\(port)"

struct ContentView: View {
    @State private var isRecording = false
    @State private var isLoading = false
    @State private var isPaused = false
    
    @State private var errorMessage: String?
    @State private var message: String?
    
    @State private var audioEngine: AVAudioEngine!
    @State private var audioPlayer: AVPlayer?
    @State private var inputNode: AVAudioInputNode!
    @State private var audioBuffer: AVAudioPCMBuffer!
    
    var body: some View {
        VStack {
            HStack {
                Spacer()
                Button("Permission") {
                    requestPermission()
                }
                .padding()
            }
            Spacer()
            if isLoading {
                ProgressView()
                    .padding()
            } else {
                Button(isRecording ? "Stop" : "Record") {
                    toggleRecording()
                }
                .padding()
                .disabled(isLoading)
                if isRecording {
                    if isPaused{
                        Button("Sleep Server"){
                            self.isPaused = false
                        }
                        .padding()
                    }
                    if !isPaused{
                        Button("Wake Server") {
                            wakeServer()
                        }
                        .padding()
                    }
                }
            }
            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .padding()
            }
            if let message = message {
                Text(message)
                    .foregroundColor(.white)
                    .padding()
            }
            Spacer()
            Button("Test Server"){
                testServer()
            }
        }
    }
    
    // Ask for audio permission from user
    func requestPermission() {
        let audioSession = AVAudioSession.sharedInstance()
        switch audioSession.recordPermission {
        case .granted:
            message = "Ready to go"
        case .denied:
            showSettingsAlert()
        case .undetermined:
            audioSession.requestRecordPermission { granted in
                DispatchQueue.main.async {
                    if !granted {
                        showSettingsAlert()
                    }
                }
            }
        @unknown default:
            print("Unknown permission state")
        }
    }
    
    // Easy navigation to settings to give audio permission
    func showSettingsAlert() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        let alert = UIAlertController(
            title: "Microphone Access Denied",
            message: "Please enable microphone access in Settings.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: nil))
        alert.addAction(UIAlertAction(title: "Settings", style: .default, handler: { _ in
            if UIApplication.shared.canOpenURL(settingsUrl) {
                UIApplication.shared.open(settingsUrl, completionHandler: nil)
            }
        }))
        
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootViewController = scene.windows.first?.rootViewController {
            rootViewController.present(alert, animated: true, completion: nil)
        }
    }
    
    // Used for, coincidentally, testing the server
    func testServer(){
        let url = URL(string: "\(serverAddress)/test")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("Error: \(error)")
                return
            }
            if let httpResponse = response as? HTTPURLResponse {
                print("HTTP Status Code: \(httpResponse.statusCode)")
            }
            if let data = data {
                print("Test received: \(data)")
            }
        }
        task.resume()
    }
    
    func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }
    
    // STOP -----
    func stopRecording() {
        isLoading = true
        errorMessage = nil
        
        // End session
        endServerSession { success, error in
            DispatchQueue.main.async {
                self.isLoading = false
                self.isRecording = false
                self.audioEngine.stop()
                self.inputNode.removeTap(onBus: 0)
                if let error = error {
                    self.errorMessage = "server failed to end: " + error
                }
            }
        }
    }
    
    func endServerSession(completion: @escaping (Bool, String?) -> Void) {
        let url = URL(string: "\(serverAddress)/endSession")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(false, "Error ending session: \(error.localizedDescription)")
                return
            }
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(false, "Invalid response")
                return
            }
            if httpResponse.statusCode == 200 {
                completion(true, nil)
            } else {
                let message = String(data: data ?? Data(), encoding: .utf8) ?? "Unknown error"
                completion(false, "Error ending session: \(message)")
            }
        }
        
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
            if task.state == .running {
                task.cancel()
                DispatchQueue.main.async {
                    completion(false, "Error: took too long")
                }
            }
        }
        task.resume()
    }
    
    // START -----
    func startRecording() {
        isLoading = true
        errorMessage = nil
        isPaused = false // Reset here in case it is paused accidentally.
        
        setupAudioSession()
        
        // Start session
        startServerSession { success, error in
            DispatchQueue.main.async {
                self.isLoading = false
                if success {
                    self.audioEngine = AVAudioEngine()
                    self.inputNode = self.audioEngine.inputNode
                    let nativeFormat = self.inputNode.inputFormat(forBus: 0)
                    let recordingFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: nativeFormat.sampleRate, channels: 1, interleaved: true)!
                    
                    self.inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, time in
                        if !self.isPaused { // If paused don't send buffer
                            self.sendAudioBuffer(buffer)
                        }
                    }
                    
                    do {
                        try self.audioEngine.start()
                        self.isRecording = true
                    } catch {
                        self.errorMessage = "Could not start audio engine: \(error)"
                    }
                } else {
                    self.errorMessage = error
                }
            }
        }
    }
    
    // Part of startRecording
    func setupAudioSession() {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .default, options: [])
            try audioSession.setActive(true)
        } catch {
            print("Failed to set up audio session: \(error)")
        }
    }
    
    // Part of startRecording
    func sendAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: buffer.format.sampleRate, channels: 1, interleaved: true) != nil else {
            print("Error creating audio format")
            return
        }
        
        // Create an audio converter to resample the buffer to the sample rate
        let targetSampleRate: Double = 16000.0
        let targetFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: targetSampleRate, channels: 1, interleaved: true)!
        let converter = AVAudioConverter(from: buffer.format, to: targetFormat)
        let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: AVAudioFrameCount(targetFormat.sampleRate) * buffer.frameLength / AVAudioFrameCount(buffer.format.sampleRate))!
        
        // Handle buffer/converter errors
        var error: NSError? = nil
        converter?.convert(to: convertedBuffer, error: &error, withInputFrom: { _, outStatus in
            outStatus.pointee = AVAudioConverterInputStatus.haveData
            return buffer
        })
        if let error = error {
            print("Error converting audio buffer: \(error)")
            return
        }
        
        // Send the actual audio
        let audioBufferList = convertedBuffer.audioBufferList.pointee
        let data = Data(bytes: audioBufferList.mBuffers.mData!, count: Int(audioBufferList.mBuffers.mDataByteSize))
        
        let url = URL(string: "\(serverAddress)/audio")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("audio/l16", forHTTPHeaderField: "Content-Type")
        let task = URLSession.shared.uploadTask(with: request, from: data) { _, _, error in
            if let error = error {
                print("Error sending audio data: \(error)")
            }
        }
        task.resume()
    }
    
    func startServerSession(completion: @escaping (Bool, String?) -> Void) {
        let url = URL(string: "\(serverAddress)/startSession")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(false, "Error starting session: \(error.localizedDescription)")
                return
            }
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(false, "Invalid response")
                return
            }
            if httpResponse.statusCode == 200 {
                completion(true, nil)
            } else {
                let message = String(data: data ?? Data(), encoding: .utf8) ?? "Unknown error"
                completion(false, "Error starting session: \(message)")
            }
        }
        
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
            if task.state == .running {
                task.cancel()
                DispatchQueue.main.async {
                    completion(false, "Error: took too long")
                }
            }
        }
        task.resume()
    }
    
    // WAKE (trigger server + response) --
    func wakeServer() {
        // Local
        guard isRecording && !isPaused else { return }
        isPaused = true
        stopRecording()
        
        // Request
        let url = URL(string: "\(serverAddress)/wake")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        // Lot of error checking - isPaused gets set more than it should.
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self.errorMessage = "Error waking server: \(error.localizedDescription)"
                    self.isPaused = false
                    return
                }
                guard let httpResponse = response as? HTTPURLResponse else {
                    self.errorMessage = "Invalid response waking server"
                    self.isPaused = false
                    return
                }
                if httpResponse.statusCode == 200 {
                    print(httpResponse)
                    self.message = "Server wake successful"
                    
                    // Save data to a temporary file and play it
                    if let data = data {
                        let tempDirectory = FileManager.default.temporaryDirectory
                        let tempFileURL = tempDirectory.appendingPathComponent("tempAudio.mp3")
                        
                        do {
                            try data.write(to: tempFileURL)
                            self.playAudio(from: url)
                        } catch {
                            self.errorMessage = "Failed to write audio data to file: \(error.localizedDescription)"
                            self.isPaused = false
                        }
                    }
                    
                    
                } else {
                    let message = String(data: data ?? Data(), encoding: .utf8) ?? "Unknown error"
                    self.errorMessage = "Error waking server: \(message)"
                    self.isPaused = false
                }
            }
        }
        
        // Return to regularly scheduled programming
        task.resume()
    }
    
    // Play audio recieved from the wake server
    func playAudio(from url: URL) {
        // Ensure the audio session is active
           do {
               let audioSession = AVAudioSession.sharedInstance()
               try audioSession.setCategory(.playback, mode: .default, options: [])
               try audioSession.setActive(true)
           } catch {
               print("Failed to set audio session for playback: \(error)")
           }
        
        self.audioPlayer = AVPlayer(url: url)
        self.audioPlayer?.volume = 1.0
        self.audioPlayer?.play()
        
        // Debugging
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            print("Player status: \(self.audioPlayer?.status.rawValue ?? -1)")
            print("Player error: \(self.audioPlayer?.error?.localizedDescription ?? "No error")")
            
            if let currentItem = self.audioPlayer?.currentItem {
                print("Current item status: \(currentItem.status.rawValue)")
                if let error = currentItem.error {
                    print("Current item error: \(error.localizedDescription)")
                }
            }
        }
    }
}
