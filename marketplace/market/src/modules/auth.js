export const getDeviceId = () => {
  let deviceId = localStorage.getItem('campus_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('campus_device_id', deviceId);
  }
  return deviceId;
};