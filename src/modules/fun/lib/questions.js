/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export const FUN_QUESTIONS = [
  {
    q: 'fxmanifest.lua dosyası ne için kullanılır?',
    options: ['Sadece logo gösterimi', 'Kaynak meta bilgisi ve export tanımları', 'Sunucu ayar dosyası'],
    correct: 1,
  },
  {
    q: 'ESX vb. sunucularda event güvenliği için en doğru yön hangisidir?',
    options: ['Client ve server eventini aynı isimle açmak', 'Server eventlerini ayrı prefix ile isimlendirmek', 'Eventi global değişkenle çağırmak'],
    correct: 1,
  },
  {
    q: 'Bir resource\'ta altın güvenlik kuralı hangisidir?',
    options: ['Girdi doğrulama ve yetki kontrolü', 'Daha fazla client dosyası eklemek', 'Performans makrosu kullanmak'],
    correct: 0,
  },
  {
    q: 'Lua thread içinde CPU\'yu serbest bırakmak için ne kullanılır?',
    options: ['sleep(0)', 'Citizen.Wait(0)', 'while true do end'],
    correct: 1,
  },
  {
    q: 'Client tarafından server eventi tetiklemek için hangi natif kullanılır?',
    options: ['TriggerServerEvent', 'TriggerEvent', 'PerformHttpRequest'],
    correct: 0,
  },
  {
    q: 'FiveM\'de "onesync" neyi ifade eder?',
    options: ['Tüm oyuncuların senkron görülmesini', 'Tek oyuncu modunu', 'Bekleme süresi ayarını'],
    correct: 0,
  },
  {
    q: 'fxmanifest.lua içindeki client_scripts ne yapar?',
    options: ['Dosyaları sunucuya yükler', 'Lua dosyalarını istemciye yükler', 'Veritabanı bağlantısı kurar'],
    correct: 1,
  },
  {
    q: 'GetPlayerPed(-1) hangi değeri döndürür?',
    options: ['Sunucu pedini', 'Yerel oyuncunun ped entity\'sini', 'En yakın araç entity\'sini'],
    correct: 1,
  },
  {
    q: 'RegisterNetEvent neden kullanılır?',
    options: ['Client tarafında ağ eventi dinlemek için', 'Chat komutu tanımlamak için', 'İzin vermek için'],
    correct: 0,
  },
  {
    q: 'server.cfg içindeki ensure komutu ne yapar?',
    options: ['Resource\'i başlatır ve çalışır tutar', 'Dosya siler', 'Oyuncuyu sunucudan atar'],
    correct: 0,
  },
  {
    q: 'Sunucuda yüksek CPU kullanımında ilk bakılacak yer neresidir?',
    options: ['Her frame çalışan döngüler ve beklemesiz kod', 'Discord tema ayarı', 'Cache klasörü boyutu'],
    correct: 0,
  },
  {
    q: 'Bir aracın net objesini almak için hangi yaklaşım doğrudur?',
    options: ['NetworkGetEntityFromNetworkId', 'GetVehicleNumberPlateText', 'SetEntityCoords'],
    correct: 0,
  },
];
